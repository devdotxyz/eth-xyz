import Env from '@ioc:Adonis/Core/Env'
import Redis from "@ioc:Adonis/Addons/Redis";
import Logger from '@ioc:Adonis/Core/Logger'
import Route53Service from './Route53Service'
import * as Sentry from '@sentry/node'
import sentryConfig from '../config/sentry'
import { InfuraProvider, Contract, namehash, toNumber } from "ethers"
import { formatsByCoinType } from '@ensdomains/address-encoder';


const APP_BSKY = '_atproto';
const APP_BSKY_ALT = '_atproto.';

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
];

Sentry.init(sentryConfig)

export default class EnsService {
  private CACHE_KEY_PREFIX = 'ens-domain-';
  private textRecordValues: object = {};
  
  private wallets: object[] = [ //https://eips.ethereum.org/EIPS/eip-2304
    {
      key: 0,
      name: 'bitcoin',
      value: null
    },
    {
      key: 2,
      name: 'litecoin',
      value: null
    },
    {
      key: 3,
      name: 'dogecoin',
      value: null
    },
    {
      key: 22,
      name: 'monacoin',
      value: null
    },
    {
      key: 60,
      name: 'ethereum',
      value: null
    }
  ];
  private promises: Promise<any>[] = [];

  constructor() {
  }

  async getTextRecords(domain) {
    Logger.debug(`Pulling ${domain}`)
    let hasError = false;

    // Lookup cached data
    if (Env.get('REDIS_ENABLED')) {
      let cachedRecord = await Redis.get(`${this.CACHE_KEY_PREFIX}${domain}`)
      if (cachedRecord) {
        return JSON.parse(cachedRecord)
      }
    }
    // Bootstrap resolver + provider
    const provider = new InfuraProvider('homestead', Env.get('INFURA_PROJECT_ID'), Env.get('INFURA_PROJECT_SECRET'));

    let resolver = await provider.getResolver(domain);

    // If this domain doesn't have a resolver
    if(resolver === null) {
      return null;
    }

    // Load ENS Text Records
    let allTextRecords = await this.getAllTextRecords(provider, domain);

    // if empty object, use fallback method since some resolvers are not supported
    if(Object.keys(allTextRecords).length === 0) {
      allTextRecords = await this.getAllTextRecordsManually(provider, domain);
    }

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
    let allAddresses = await this.getAllAddresses(provider, domain);

    console.log('allAddresses', allAddresses);

    this.textRecordValues['wallets'] = [];

    Object.keys(allAddresses).forEach((address) => {
      this.textRecordValues['wallets'].push(
        {
          key: allAddresses[address].key,
          name: allAddresses[address].longName,
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

  async getAllTextRecords(provider, name) {

    const abi = [
      "event TextChanged(bytes32 indexed nodehash, string indexed _key, string key)"
    ];

    // Get the resolver for the name
    const resolver = await provider.getResolver(name);
  
    const contract = new Contract(resolver.address, abi, provider);
  
    // Get all the TextChanged logs for the name on its resolver
    const logs = await contract.queryFilter(contract.filters.TextChanged(namehash(name)));
  
    // Get the *unique* keys
    const keys = [ ...(new Set(logs.map((log) => log.args.key))) ];
  
    // Get the values for the keys
    const values = await Promise.all(keys.map((key) => {
        try {
            return resolver.getText(key);
        } catch (error) { }
        return null;
    }));
  
    // Return a nice dictionary of the key/value pairs
    return keys.reduce((accum, key, index) => {
        const value = values[index];

        if (value != null) { accum[key] = value; }
        return accum;
    }, { });
  }

  async getAllTextRecordsManually(provider, name) {
    // Load ENS Text Records
    const resolver = await provider.getResolver(name);

    const values = await Promise.all(textRecordKeys.map((key) => {
      try {
          return resolver.getText(key);
      } catch (error) { }
      return null;
    }));

    return textRecordKeys.reduce((accum, key, index) => {
      const value = values[index];

      if (value != null) { accum[key] = value; }
      return accum;
    }, { });
  }

  async getAllAddresses(provider, name) {

    const abi = [
      "event AddressChanged(bytes32 indexed node, uint256 coinType, bytes newAddress)"
    ];

    // Get the resolver for the name
    const resolver = await provider.getResolver(name);
  
    const contract = new Contract(resolver.address, abi, provider);
  
    // Get all the TextChanged logs for the name on its resolver
    const logs = await contract.queryFilter(contract.filters.AddressChanged(namehash(name)));


     // Get the *unique* keys
     const coinTypes = [ 
      ...(new Set(logs.map((log) => {
        return {
        'coinType': toNumber(log.args.coinType),
        'value': log.args.newAddress,
      }
    }))) 
    ];

    // only return last address for each coin type coinType
    const result = Object.values(
      coinTypes.reduce((accumulator, item) => {
        const { coinType, ...rest } = item;
        return {
          ...accumulator,
          [coinType]: { coinType, ...rest }
        };
      }, {})
    );
    
    // console.log(result);
      
  
    // Return a nice dictionary of the key/value pairs
    return result.reduce((accum, key, index) => {
        const value = result[index];
        if (value != null) { 
          let AddressDefinition = this.wallets.find((wallet) => wallet.key === value.coinType)

          accum[value.coinType] = {
            'coinType': value.coinType,
            'value': value.value,
            'name': formatsByCoinType[value.coinType].name,
            'longName': (AddressDefinition && AddressDefinition.name) ?? formatsByCoinType[value.coinType].name
          }
        }
        return accum;
    }, { });
  }

}
