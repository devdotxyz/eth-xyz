import Env from '@ioc:Adonis/Core/Env'
import Redis from '@ioc:Adonis/Addons/Redis';
import Logger from '@ioc:Adonis/Core/Logger'
import Route53Service from './Route53Service'
import * as Sentry from '@sentry/node'
import sentryConfig from '../config/sentry'
import { InfuraProvider, Contract, namehash, getAddress } from 'ethers'
import { formatsByCoinType } from '@ensdomains/address-encoder'
import { MulticallProvider } from '@ethers-ext/provider-multicall'
import { EXTRA_EVM_CHAINS, EVM_COIN_TYPE_BASE, EXTRA_EVM_NAME_BY_COIN_TYPE } from './evmChains'

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

  // Provider construction is centralized so the network is set in one place. ENS_NETWORK
  // lets us point at a testnet (e.g. sepolia) for verification; defaults to mainnet.
  private getProvider() {
    return new InfuraProvider(
      Env.get('ENS_NETWORK', 'mainnet'),
      Env.get('INFURA_PROJECT_ID'),
      Env.get('INFURA_PROJECT_SECRET')
    )
  }

  public async getAllDomainAddresses(domain) {
    if (Env.get('REDIS_ENABLED')) {
      let cachedRecord = await Redis.get(`${this.CACHE_KEY_PREFIX_ADDRESS}${domain}`)
      if (cachedRecord) {
        return JSON.parse(cachedRecord)
      }
    }

    const provider = this.getProvider()
    let addresses = await this.getAllAddresses(provider, domain)
    if (Env.get('REDIS_ENABLED')) {
      await Redis.setex(
        `${this.CACHE_KEY_PREFIX_ADDRESS}${domain}`,
        Env.get('RESULT_CACHE_SECONDS'),
        JSON.stringify(addresses)
      )
    }
    return addresses
  }

  async getTextRecords(domain) {
    Logger.debug(`Pulling ${domain}`)
    let hasError = false

    if (Env.get('REDIS_ENABLED')) {
      let cachedRecord = await Redis.get(`${this.CACHE_KEY_PREFIX}${domain}`)
      if (cachedRecord) {
        return JSON.parse(cachedRecord)
      }
    }

    // Bootstrap resolver + provider
    const provider = this.getProvider();

    let resolver = await provider.getResolver(domain).catch((err) => {
      console.log(`ERROR on getResolver() for ${domain}:`, err)
      Sentry.captureException(`ERROR on getResolver() for ${domain}: ${err}`)
    })
    
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
    const mcProvider = new MulticallProvider(provider)
    const textContract = new Contract(
      resolver.address,
      ['function text(bytes32 node, string key) view returns (string)'],
      mcProvider
    )
    const node = namehash(name)

    // Bounded like getAllAddresses: MulticallProvider hangs if the batched eth_call fails,
    // so a provider blip throws here instead of hanging the whole resolution.
    const values = await withTimeout(
      Promise.all(textRecordKeys.map((key) => {
        try {
            return textContract.text(node, key);
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
      resolver = await provider.getResolver(name)
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
    const abi = ['function addr(bytes32 node, uint256 coinType) view returns (bytes)']

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
        const contract = new Contract(resolver.address, abi, new MulticallProvider(provider))
        return await withTimeout(
          Promise.all(
            chunk.map((coinType) =>
              contract.addr(node, coinType).catch((err) => {
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

    return candidates.reduce((accum: Record<string, any>, coinType, index) => {
      const value = values[index]
      // '0x' means the coin type is not currently set on the resolver
      if (value != null && value !== '0x') {
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
