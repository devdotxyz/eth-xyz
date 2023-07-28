import Env from '@ioc:Adonis/Core/Env'
import Redis from "@ioc:Adonis/Addons/Redis";
import Logger from '@ioc:Adonis/Core/Logger'
import Route53Service from './Route53Service'
import * as Sentry from '@sentry/node'
import sentryConfig from '../config/sentry'
import { InfuraProvider } from "ethers"

const APP_BSKY = '_atproto.';

Sentry.init(sentryConfig)

export default class EnsService {
  private CACHE_KEY_PREFIX = 'ens-domain-';
  private textRecordValues: object = {};
  private textRecordKeys: string[] = [
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
    'io.keybase',
    'org.telegram',
    APP_BSKY,
  ];
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

    // @ts-ignore
    Logger.debug(resolver)

    // Load ENS Text Records
    this.textRecordKeys.forEach((textKey) => {
        this.promises.push(
          // @ts-ignore
          resolver.getText(textKey).then((result) => {
            let proceedWithSettingRecord = true;
            if(textKey === APP_BSKY) {
              if(this.isBlueSkyRecordValid(result)){
                this.searchAndSetVerificationRecord(domain, result);
              } else {
                proceedWithSettingRecord = false;
                Sentry.captureException(`Validation Failed For BlueSky Record for ${domain} with value ${result}`)
              }
            }

            if(proceedWithSettingRecord){
              this.textRecordValues[textKey] = result !== null && result !== '' ? result : null;
            }
          }
        ).catch((err) => {
          console.log(err)
        })
      );
    });

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

    // Load Wallet Records
    this.wallets.forEach((walletObj, walletIndex) => {
     
      this.promises.push(
        // @ts-ignore
        resolver
          .getAddress(walletObj['key'])
          .then((result) => {
            // @ts-ignore
            this.wallets[walletIndex].value = result
          })
          .catch((err) => {
            // do not throw an error since this profile doesnt have a wallet for this coin
            console.log(err)
            })
      );
    });

    await Promise.all(this.promises);
    this.textRecordValues['wallets'] = this.wallets;
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
}
