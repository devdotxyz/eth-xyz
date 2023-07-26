import Env from '@ioc:Adonis/Core/Env'
import Redis from "@ioc:Adonis/Addons/Redis";
import Logger from '@ioc:Adonis/Core/Logger'
import Route53Service from './Route53Service'

const APP_BSKY = '_atproto.';

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
    const ethers = require('ethers')
    const provider = new ethers.providers.InfuraProvider('homestead', {
      projectId: Env.get('INFURA_PROJECT_ID'),
      projectSecret: Env.get('INFURA_PROJECT_SECRET'),
    });
    // uncomment to use all providers
    // const provider = new ethers.getDefaultProvider('homestead', {
    //   alchemy: Env.get('ALCHEMY_API'),
    //   etherscan: Env.get('ETHERSCAN_API'),
    //   infura: {
    //     projectId: Env.get('INFURA_PROJECT_ID'),
    //     projectSecret: Env.get('INFURA_PROJECT_SECRET'),
    //   },
    //   pocket: {
    //     applicationId: Env.get('POKT_PORTAL_ID'),
    //     applicationSecretKey: Env.get('POKT_PORTAL_SECRET'),
    //   }
    // });
    let resolver = await provider.getResolver(domain);

    Logger.debug(resolver)
    // If this domain doesn't have a resolver
    if(resolver === null) {
      return null;
    }

    // Load ENS Text Records
    this.textRecordKeys.forEach((textKey) => {
        this.promises.push(
          resolver.getText(textKey).then((result) => {
            this.textRecordValues[textKey] = result;
            if(textKey === APP_BSKY) {
                this.searchAndSetVerificationRecord(domain, result);
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
     
      // @ts-ignore
      this.promises.push(
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
