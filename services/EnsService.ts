import Env from '@ioc:Adonis/Core/Env'
import Redis from '@ioc:Adonis/Addons/Redis';
import Logger from '@ioc:Adonis/Core/Logger'
import Route53Service from './Route53Service'
import * as Sentry from '@sentry/node'
import sentryConfig from '../config/sentry'
import { AlchemyProvider, Contract, namehash } from 'ethers'
import { formatsByCoinType } from '@ensdomains/address-encoder'
import { MulticallProvider } from '@ethers-ext/provider-multicall'

const APP_BSKY = '_atproto'
const APP_BSKY_ALT = '_atproto.'
const RPC_THROTTLE_MS = 1000

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

  private getProvider() {
    return new AlchemyProvider('mainnet', Env.get('ALCHEMY_API'))
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
    const provider = this.getProvider()

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

    const values = await Promise.all(textRecordKeys.map((key) => {
      try {
          return textContract.text(node, key);
      } catch (error) { }
      return null;
    }));

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

    // Query addr(node, coinType) directly for the known coin types, batched into a single
    // RPC request via MulticallProvider — same pattern as getAllTextRecordsManually.
    // This replaces the previous AddressChanged event-log scan, which required eth_getLogs
    // over the full chain history: Alchemy's free tier rejects ranges over 10 blocks, and it
    // was the most credit-expensive call on Infura (255 credits per eth_getLogs).
    // addr() returns the same bytes as the AddressChanged log payload, so the output shape
    // is unchanged.
    const mcProvider = new MulticallProvider(provider)
    const addrContract = new Contract(
      resolver.address,
      ['function addr(bytes32 node, uint256 coinType) view returns (bytes)'],
      mcProvider
    )
    const node = namehash(name)

    const values = await Promise.all(
      this.wallets.map((wallet) => addrContract.addr(node, wallet['key']).catch(() => null))
    )

    return this.wallets.reduce((accum, wallet, index) => {
      const value = values[index]

      // '0x' means the coin type is not set on the resolver
      if (value != null && value !== '0x') {
        const coinType = wallet['key']
        accum[coinType] = {
          'coinType': coinType,
          'value': value,
          'name': formatsByCoinType[coinType].name,
          'longName': wallet['name'] ?? formatsByCoinType[coinType].name
        }
      }
      return accum
    }, {})
  }

}
