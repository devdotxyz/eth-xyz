import Env from '@ioc:Adonis/Core/Env'
import Redis from '@ioc:Adonis/Addons/Redis';
import Logger from '@ioc:Adonis/Core/Logger'
import Route53Service from './Route53Service'
import * as Sentry from '@sentry/node'
import sentryConfig from '../config/sentry'
import { Contract, Interface, namehash, getAddress, dnsEncode } from 'ethers'
import { formatsByCoinType } from '@ensdomains/address-encoder'
import { MulticallProvider } from '@ethers-ext/provider-multicall'
import { EXTRA_EVM_CHAINS, EVM_COIN_TYPE_BASE, EXTRA_EVM_NAME_BY_COIN_TYPE } from './evmChains'
import { providerFailoverOrder } from './rpc'

const APP_BSKY = '_atproto'
const APP_BSKY_ALT = '_atproto.'
const RPC_THROTTLE_MS = 1000

// MulticallProvider leaves its queued call promises pending if the batched eth_call fails
// (provider error / timeout), so we bound each batch and convert a stuck call into a throw.
const MULTICALL_TIMEOUT_MS = 15000

const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  let timer: any
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/*
 * ethers 6.14+ looks names up through the ENS Universal Resolver, which reverts with
 * ResolverNotFound for names that don't exist. That's a definitive "no resolver" answer,
 * not a provider failure, so it must not trigger failover.
 */
const isResolverNotFound = (err: any): boolean =>
  String(err?.revert?.name ?? err).includes('ResolverNotFound')

const getResolverOrNull = async (provider, domain) => {
  try {
    return await withTimeout(
      provider.getResolver(domain),
      MULTICALL_TIMEOUT_MS,
      `getResolver(${domain})`
    )
  } catch (err) {
    if (isResolverNotFound(err)) {
      return null
    }
    throw err
  }
}

/*
 * Returns a function that reads one record type (e.g. addr(node, coinType) or
 * text(node, key)) from a name's resolver, in whichever way that resolver supports.
 *
 * Why this exists: there are two ways to ask an ENS resolver for a record.
 *
 *   1. Direct call: resolver.addr(node, coinType). Classic resolvers (the v1
 *      PublicResolvers) answer this.
 *   2. ENSIP-10 "extended" call: resolver.resolve(dnsEncodedName, calldata), where
 *      calldata is the ABI-encoded direct call from (1), and the bytes that come back
 *      are ABI-decoded with that call's return type.
 *      Spec: https://docs.ens.domains/ensip/10
 *
 * Resolvers that support ENSIP-10 advertise it with supportsInterface(0x9061b923), and
 * the spec says clients must use resolve() for them. Many of them revert on direct calls.
 *
 * When ENSv2 went live on 2026-10-27 (~13:17 UTC), the Universal Resolver (which ethers
 * uses in provider.getResolver()) started returning ENSv2 resolvers for .eth names. For
 * example, maaria.eth and vitalik.eth moved to 0x394D8EB4a4fDF599384DeAb25F31d111d755c398
 * (ENSV1Resolver, which serves their existing v1 records). These are ENSIP-10 resolvers
 * and revert on direct addr()/text() calls. We were making direct calls, so every
 * lookup failed: profiles lost their records and /api/collection 500'd on the missing
 * ETH address.
 * Rollout: https://discuss.ens.domains/t/executable-activate-ensv2/22483
 *
 * This mirrors what ethers' own Resolver does (Resolver.#fetch in
 * node_modules/ethers/lib.commonjs/providers/ens-resolver.js): check supportsWildcard(),
 * then either call directly or wrap in resolve(dnsEncode(name, 255), calldata). We don't
 * just call ethers' resolver.getAddress()/getText() because they make one RPC request per
 * record, and getAllAddresses() checks hundreds of coin types. Taking a provider lets
 * callers pass a MulticallProvider, so all those reads are batched into a few eth_calls.
 *
 * Known limitation (same as before this change): ethers enables CCIP-Read (EIP-3668) for
 * offchain resolvers, but a batched multicall can't follow an OffchainLookup revert. Names
 * whose records live offchain therefore get a CALL_EXCEPTION, which callers treat as
 * "record not set".
 */
const resolverRecordReader = async (resolver, name, signature: string, provider) => {
  const iface = new Interface([signature])
  const method = iface.fragments[0]['name']

  // ethers caches the supportsInterface(0x9061b923) result on the Resolver instance, so
  // calling this once per chunk costs a single RPC request per lookup, not one per chunk.
  if (!(await resolver.supportsWildcard())) {
    const contract = new Contract(resolver.address, iface, provider)
    return (...args) => contract[method](...args)
  }

  const extended = new Contract(
    resolver.address,
    ['function resolve(bytes name, bytes data) view returns (bytes)'],
    provider
  )
  // ENSIP-10 passes the name in DNS wire format (RFC 1035 §3.1). The 255 max label length
  // matches ethers. The DNS default of 63 would reject long ENS labels, which are valid.
  const dnsName = dnsEncode(name, 255)
  return async (...args) => {
    const result = await extended.resolve(dnsName, iface.encodeFunctionData(method, args))
    return iface.decodeFunctionResult(method, result)[0]
  }
}

const textRecordKeys = [
  'avatar',
  'description',
  'display',
  'email',
  'keywords',
  'mail',
  'notice',
  'location',
  'phone',
  'url',
  'com.github',
  'com.peepeth',
  'com.linkedin',
  'com.twitter',
  'com.discord',
  'com.reddit',
  'io.keybase',
  'org.telegram',
  APP_BSKY,
  APP_BSKY_ALT,
]

Sentry.init(sentryConfig)

export default class EnsService {
  private CACHE_KEY_PREFIX = 'ens-domain-'
  private CACHE_KEY_PREFIX_ADDRESS = 'ens-domain-address'
  private textRecordValues: object = {}

  private wallets: object[] = [
    //https://eips.ethereum.org/EIPS/eip-2304
    {
      key: 0,
      name: 'bitcoin',
      value: null,
    },
    {
      key: 2,
      name: 'litecoin',
      value: null,
    },
    {
      key: 3,
      name: 'dogecoin',
      value: null,
    },
    {
      key: 22,
      name: 'monacoin',
      value: null,
    },
    {
      key: 60,
      name: 'ethereum',
      value: null,
    },
  ]
  private promises: Promise<any>[] = []

  constructor() {}

  public async getAllDomainAddresses(domain) {
    if (Env.get('REDIS_ENABLED')) {
      let cachedRecord = await Redis.get(`${this.CACHE_KEY_PREFIX_ADDRESS}${domain}`)
      if (cachedRecord) {
        return JSON.parse(cachedRecord)
      }
    }

    for (const source of providerFailoverOrder()) {
      try {
        let addresses = await this.getAllAddresses(source.createProvider(), domain)
        if (Env.get('REDIS_ENABLED')) {
          await Redis.setex(
            `${this.CACHE_KEY_PREFIX_ADDRESS}${domain}`,
            Env.get('RESULT_CACHE_SECONDS'),
            JSON.stringify(addresses)
          )
        }
        return addresses
      } catch (err) {
        console.log(`ERROR on getAllDomainAddresses() via ${source.name} for ${domain}:`, err)
        Sentry.captureException(
          `ERROR on getAllDomainAddresses() via ${source.name} for ${domain}: ${err}`
        )
      }
    }
    return null
  }

  async getTextRecords(domain) {
    Logger.debug(`Pulling ${domain}`)

    if (Env.get('REDIS_ENABLED')) {
      let cachedRecord = await Redis.get(`${this.CACHE_KEY_PREFIX}${domain}`)
      if (cachedRecord) {
        return JSON.parse(cachedRecord)
      }
    }

    for (const source of providerFailoverOrder()) {
      try {
        return await this.loadTextRecords(source.createProvider(), domain)
      } catch (err) {
        console.log(`ERROR on getTextRecords() via ${source.name} for ${domain}:`, err)
        Sentry.captureException(`ERROR on getTextRecords() via ${source.name} for ${domain}: ${err}`)
      }
    }
    return null
  }

  // Provider-level failures throw so the caller can fail over; no resolver returns null
  private async loadTextRecords(provider, domain) {
    let hasError = false

    // Reset per attempt so a failed first provider can't leak partial results into the retry
    this.textRecordValues = {}
    this.promises = []

    let resolver = await getResolverOrNull(provider, domain)

    // If this domain doesn't have a resolver
    if(!resolver) {
      return null;
    }

    // Load ENS Text Records
    await new Promise((resolve) => setTimeout(resolve, RPC_THROTTLE_MS))
    let allTextRecords = await this.getAllTextRecordsManually(provider, domain, resolver);

    // modify records based on custom text keys, e.g. _atproto
    Object.keys(allTextRecords).forEach((textKey) => {
      const result = allTextRecords[textKey];
      let proceedWithSettingRecord = true;
      if(textKey === APP_BSKY || textKey === APP_BSKY_ALT) {
        this.textRecordValues['bluesky_error'] = false;
        if(result === null || result.trim() === '') {
          return;
        }
        if(this.isBlueSkyRecordValid(result)){
          this.searchAndSetVerificationRecord(domain, result);
        } else {
          proceedWithSettingRecord = false;
          this.textRecordValues['bluesky_error'] = true;
          Sentry.captureException(`Validation Failed For BlueSky Record for ${domain} with value ${result}`)
        }
      }

      if(proceedWithSettingRecord){
        this.textRecordValues[textKey] = result !== null && result !== '' ? result : null;
      }
    });

    // @ts-ignore
    Logger.debug(resolver)

    // Add Content Hash (not really a text record, but we'll store it here regardless)
    this.promises.push(
      resolver.getContentHash().then((result) => {
          this.textRecordValues['contentHash'] = result;
        }
      ).catch((err) => {
          // do not throw an error since this isnt an offchain request
          console.log(err)
      })
    );

    // Load All Addresses
    await new Promise((resolve) => setTimeout(resolve, RPC_THROTTLE_MS))
    let allAddresses = await this.getAllAddresses(provider, domain, resolver);

    this.textRecordValues['wallets'] = [];

    Object.keys(allAddresses as object).forEach((address) => {
      this.textRecordValues['wallets'].push(
        {
          // @ts-ignore
          key: allAddresses[address].key,
          // @ts-ignore
          name: allAddresses[address].longName,
          // @ts-ignore
          value: allAddresses[address].value
        },
      );
    });

    await Promise.all(this.promises);
    this.textRecordValues['provider_error'] = hasError;

    if (Env.get('REDIS_ENABLED')) {
      await Redis.setex(`${this.CACHE_KEY_PREFIX}${domain}`, Env.get('RESULT_CACHE_SECONDS'), JSON.stringify(this.textRecordValues));
    }

    return this.textRecordValues;
  }

  public isBlueSkyRecordValid(record) {

    // validate record in a single string with the following constraints:
    // 1. starts with did=did:plc:
    // 2. anything after did:plc: only alphanumeric
    // 3. anything after did:plc: is 24 chars long (total of 36 chars)
    if(!record.match(/^did=did:plc:[0-9a-zA-Z]{24}$/)) {
      return false;
    }
    return true;
  }

  async searchAndSetVerificationRecord(domain, record) {
    let key = '_atproto.' + domain + '.xyz' + '.';

    const route53Service = new Route53Service();
    route53Service.setDomainRecord(key, record);
  }

  public getTextRecordValues() {
    return this.textRecordValues;
  }

  async clearProfileCache(domain) {
    if (Env.get('REDIS_ENABLED')) {
      await Redis.del(`${this.CACHE_KEY_PREFIX}${domain}`);
    }
  }

  /*
   * getAllTextRecords - Disabled to reduce Infura API credit usage.
   * This method scans the full blockchain history (eth_getLogs) to discover custom text record keys.
   * Cost: 765+ credits/request (3x eth_getLogs at 255 each), exceeding the 500 credits/sec free tier limit.
   * The frontend does not render custom text records, so we use getAllTextRecordsManually instead,
   * which queries only the known keys directly via eth_call (80 credits each).
   *
  private async getAllTextRecords(_provider, name) {
    // Prepare a multicall-based provider to batch all the call operations
    const provider = new MulticallProvider(_provider)

    // Get the resolver for the given name
    const resolver = await provider.getResolver(name)

    // A contract instance; used filter and parse logs
    const contract1 = new Contract(
      resolver.address,
      ['event TextChanged(bytes32 indexed node, string indexed _key, string key)'],
      provider
    )

    // ENS changed its contract signature for TextChanged, we need to support both
    const contract2 = new Contract(
      resolver.address,
      ['event TextChanged(bytes32 indexed node, string indexed _key, string key, string keyvalue)'],
      provider
    )

    // Set filters for both contracts
    const filter1 = contract1.filters.TextChanged(namehash(name))
    const filter2 = contract2.filters.TextChanged(namehash(name))

    // Get the matching logs from contract1
    const logs = await contract1.queryFilter(filter1)
    // Get the matching logs from contract2
    logs.push(...(await contract2.queryFilter(filter2)))

    // Filter the *unique* keys
    const keyValues = [...new Set(logs.map((log) => {
          // if log.args.keyvalue is undefined, then return just keys
          if (log.args.keyvalue === undefined) {
            return [log.args.key, null]
          } else {
            return [log.args.key, log.args.keyvalue]
          }
        })
      ),
    ]

    // Get the values for the keys; failures are discarded
    const values = await Promise.all(
      keyValues.map((key) => {
        if (key[1] !== null) {
          return key[1]
        }

        try {
          return resolver.getText(key[0])
        } catch (error) {
          console.log('error', error)
        }
        return null
      })
    )

    // Return key/value pairs
    return keyValues.reduce((accum, key, index) => {
      const value = values[index]
      if (value !== null) {
        accum[key[0]] = value
      }
      return accum
    }, {})
  }
  */

  async getAllTextRecordsManually(provider, name, resolver) {
    // Load ENS Text Records via MulticallProvider to batch all getText calls into a single RPC request
    // Not a plain Contract.text(): ENSv2/ENSIP-10 resolvers revert on direct calls. See resolverRecordReader.
    const readText = await resolverRecordReader(
      resolver,
      name,
      'function text(bytes32 node, string key) view returns (string)',
      new MulticallProvider(provider)
    )
    const node = namehash(name)

    // Bounded like getAllAddresses: MulticallProvider hangs if the batched eth_call fails,
    // so a provider blip throws here instead of hanging the whole resolution.
    const values = await withTimeout(
      Promise.all(textRecordKeys.map((key) => {
        try {
            return readText(node, key);
        } catch (error) { }
        return null;
      })),
      MULTICALL_TIMEOUT_MS,
      `getAllTextRecordsManually(${name})`
    )

    return textRecordKeys.reduce((accum, key, index) => {
      const value = values[index];

      if (value != null && value !== '') { accum[key] = value; }
      return accum;
    }, { });
  }

  async getAllAddresses(provider, name, resolver = null) {
    if (!resolver) {
      resolver = await getResolverOrNull(provider, name)
    }

    if (resolver === null) {
      return null
    }

    // Discover addresses by reading addr(node, coinType) directly for every coin type we
    // know about, batched into one request via MulticallProvider. This replaces the
    // previous AddressChanged event-log scan (an unbounded eth_getLogs over the full chain
    // history) that exceeds Infura's 10,000-block getLogs range limit.
    //
    // Candidate set = every coin type @ensdomains/address-encoder enumerates (all SLIP-44
    // coins + named EVM chains) plus the EVM chains it doesn't list (see ./evmChains). To
    // support another EVM chain, add it to EXTRA_EVM_CHAINS there. Unlike the log scan this
    // returns only currently set addresses, so coin types set and later cleared no longer
    // appear as empty "0x" rows.
    const coinTypes = new Set<number>(Object.keys(formatsByCoinType).map(Number))
    for (const chain of EXTRA_EVM_CHAINS) {
      coinTypes.add(EVM_COIN_TYPE_BASE + chain.chainId)
    }
    const candidates = [...coinTypes]

    const node = namehash(name)

    // The deployless multicall runs every sub-call inside one eth_call, which runs out of
    // gas past ~100 calls, so we split the candidates into small chunks (one eth_call each)
    // and run the chunks concurrently. A per-coin CALL_EXCEPTION means the resolver reverted
    // for that coin type (e.g. it predates addr(bytes32,uint256)) — treat as unset. A
    // chunk-level failure (timeout or a batched-call error) is a provider/network problem, so
    // we record it and throw below rather than caching a partial wallet list as success.
    let providerError: any = null
    const CHUNK_SIZE = 25
    const chunks: number[][] = []
    for (let i = 0; i < candidates.length; i += CHUNK_SIZE) {
      chunks.push(candidates.slice(i, i + CHUNK_SIZE))
    }
    const fetchChunk = async (chunk: number[]) => {
      try {
        // Not a plain Contract.addr(): ENSv2/ENSIP-10 resolvers revert on direct calls. See resolverRecordReader.
        const readAddr = await resolverRecordReader(
          resolver,
          name,
          'function addr(bytes32 node, uint256 coinType) view returns (bytes)',
          new MulticallProvider(provider)
        )
        return await withTimeout(
          Promise.all(
            chunk.map((coinType) =>
              readAddr(node, coinType).catch((err) => {
                if (err?.code !== 'CALL_EXCEPTION') providerError = err
                return null
              })
            )
          ),
          MULTICALL_TIMEOUT_MS,
          `getAllAddresses(${name})`
        )
      } catch (err: any) {
        providerError = err
        return chunk.map(() => null)
      }
    }
    const values = (await Promise.all(chunks.map(fetchChunk))).flat()

    if (providerError) {
      console.log(`ERROR on getAllAddresses() for ${name}:`, providerError)
      Sentry.captureException(`ERROR on getAllAddresses() for ${name}: ${providerError}`)
      throw providerError
    }

    // Collapse the ENSIP-11 default-EVM fallback: some resolvers return the "default" EVM
    // address (coin type EVM_COIN_TYPE_BASE) for every EVM chain, even ones the owner never set,
    // which would otherwise render dozens of identical rows. When a default is present, drop the
    // EVM chains that merely echo it (the "Default EVM" row already covers them) and keep only
    // chains set to a different address. Non-EVM coins and ETH (coin type 60) are unaffected.
    const defaultIndex = candidates.indexOf(EVM_COIN_TYPE_BASE)
    const defaultValue = defaultIndex >= 0 ? values[defaultIndex] : null
    const hasDefaultEvm = defaultValue != null && defaultValue !== '0x'

    return candidates.reduce((accum: Record<string, any>, coinType, index) => {
      const value = values[index]
      // '0x' means the coin type is not currently set on the resolver
      if (value != null && value !== '0x') {
        // Skip EVM chains that just echo the default (resolver fallback, not an owner choice).
        if (hasDefaultEvm && coinType > EVM_COIN_TYPE_BASE && value === defaultValue) {
          return accum
        }
        const definition = this.wallets.find((wallet) => (wallet as any)['key'] === coinType)
        // Prefer the library's name; fall back to our EVM chain name so chains it doesn't
        // know (e.g. Base) show their name instead of a blank label.
        const coinName =
          (formatsByCoinType as any)[coinType]?.name ||
          EXTRA_EVM_NAME_BY_COIN_TYPE.get(coinType) ||
          ''
        accum[coinType] = {
          'coinType': coinType,
          'value': this.encodeCoinAddress(coinType, value),
          'name': coinName,
          'longName': (definition && (definition as any)['name']) ?? coinName,
        }
      }
      return accum
    }, {})
  }

  // Encode a resolver's raw addr() bytes into the coin's human-readable address, matching
  // what app.ens.domains renders. EVM chains (ENSIP-11, coinType >= 0x80000000) are EIP-55
  // checksummed hex; other coins use the address-encoder library. Falls back to the raw
  // value if encoding fails (e.g. a coin the library doesn't know how to encode).
  private encodeCoinAddress(coinType: number, value: string): string {
    try {
      if (coinType >= EVM_COIN_TYPE_BASE) {
        return getAddress(value)
      }
      const format = (formatsByCoinType as any)[coinType]
      if (format) {
        return format.encoder(Buffer.from(value.slice(2), 'hex'))
      }
    } catch (err) {
      // Encoding failed — log it (so we learn which coin types we can't render) and fall
      // back to the raw value below rather than dropping the address entirely.
      console.log(`Failed to encode address for coinType ${coinType} (${value}):`, err)
      Sentry.captureException(`Failed to encode address for coinType ${coinType} (${value}): ${err}`)
    }
    return value
  }

}
