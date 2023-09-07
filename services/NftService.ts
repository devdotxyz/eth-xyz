import Env from '@ioc:Adonis/Core/Env'
import Redis from "@ioc:Adonis/Addons/Redis";

export default class NftService {
  private CACHE_KEY_PREFIX = 'wallet-nfts-';

  private allData = [];

  async getNfts(ethWalletAddress) {

    // if (Env.get('REDIS_ENABLED')) {
    //   let cachedRecord = await Redis.get(`${this.CACHE_KEY_PREFIX}${ethWalletAddress}`)
    //   if (cachedRecord) {
    //     return JSON.parse(cachedRecord)
    //   }
    // }

    let response = [];
    let responseStep = ['a'];
    let offset = 0;

    let paginate = true;

    // do {
    //   let responseStep = await this.loadV2Data(ethWalletAddress, null).then(response => {
    //     paginate = false;
    //     console.log('response', response);
    //   });
    // }while (paginate);

    let nftData = await this.loadV2Data(ethWalletAddress, null).then(response => {
      console.log('allDataaaaa', this.allData.length);

              // console.log('asset', asset);

      return this.allData.map((asset)=> {
        // console.log(asset);
        return {
          'id': asset['identifier'],
          'image_url': asset['image_url'], 
          'name': asset['name'], 
          'description': asset['description'], 
          'collection': asset['collection'],
          'contract': asset['contract'],  
          'metadata_url': asset['metadata_url'],
          'token_standard': asset['token_standard'],
          'is_disabled': asset['is_disabled'],   
        }
      });
    });

    // console.log('nftData', nftData);


    // do {
    //   let responseStep = await this.loadData(ethWalletAddress, offset).then(response => {
    //     let assets = JSON.parse(<string>response).assets;
    //     return assets.map((asset)=> {
    //       return {
    //         'id': asset['id'], 
    //         'image_url': asset['image_url'], 
    //         'image_preview_url': asset['image_preview_url'], 
    //         'image_thumbnail_url': asset['image_thumbnail_url'], 
    //         'image_original_url': asset['image_original_url'],
    //         'name': asset['name'],
    //         'description': asset['description'],  
    //         'external_link': asset['external_link'],
    //         'animation_original_url': asset['animation_original_url'],
    //         'animation_url': asset['animation_url'],
    //         'permalink': asset['permalink'],
    //         'asset_contract': {
    //           'address': asset['asset_contract']['address']
    //         },
    //         'creator': {
    //           'user': {
    //             'username': asset['creator'] && asset['creator']['user']  && asset['creator']['user']['username']
    //           },
    //           'profile_img_url': asset['creator'] && asset['creator']['profile_img_url']
    //         }
    //       }
    //     })

    //   });
    //   response = response.concat(responseStep);
    //   offset += 200;

    //   // Not really sure why I need to explicitly break, but apparently I do
    //   if(responseStep.length == 0) {
    //     break;
    //   }
    // } while (responseStep.length > 0);

    // if (Env.get('REDIS_ENABLED')) {
    //   let jsonString = JSON.stringify(response);
    //   let cacheSeconds = Env.get('RESULT_CACHE_SECONDS');
    //   // roughly 1/2 mb worth of data
    //   if (jsonString && jsonString.length > 500000) {
    //     cacheSeconds = Env.get('RESULT_CACHE_SECONDS_LARGE_PROFILES')
    //   }
    //   await Redis.setex(`${this.CACHE_KEY_PREFIX}${ethWalletAddress}`, cacheSeconds, jsonString);
    // }
    return nftData;
  }

  async loadV2Data(ethWalletAddress, nextCursor) {
    let https = require('https');
    let options = {
      hostname: 'api.opensea.io',
      port: 443,
      path: `/v2/chain/ethereum/account/${ethWalletAddress}/nfts?limit=50`,
      method: 'GET',
      headers: {
        'X-API-KEY': Env.get('OPENSEA_API_KEY'),
        'Accept': 'application/json'
      }
    }

    if (nextCursor) {
      options.path = `${options.path}&next=${nextCursor}`;
    }


    return new Promise((resolve, reject) => {
      https.get(options, (resp) => {
        let data = '';

        // A chunk of data has been recieved.
        resp.on('data', (chunk) => {
          data += chunk;
        });

        // The whole response has been received. Print out the result.
        resp.on('end', () => {
          resolve(data);
        });

      }).on("error", (err) => {
        reject(err);
      });
    }).then((data) => {
      let json = JSON.parse(data);
      console.log('json', json.next);
      // @ts-ignore
      this.allData.push(...json.nfts);

      console.log('allData', this.allData.length);

      if (typeof json.next === 'undefined') {
        console.log('LAST ONE');
       return;
      }

      console.log('recursive call');
      this.loadV2Data(ethWalletAddress, json.next);
      return;
      

    });

    return;
  };

  loadData(ethWalletAddress, offset) {
    console.log('ethWalletAddress', ethWalletAddress);
    let https = require('https');
    let options = {
      hostname: 'api.opensea.io',
      port: 443,
      path: `/api/v1/assets?owner=${ethWalletAddress}&order_direction=desc&offset=${offset}&limit=200`,
      method: 'GET',
      headers: {
        'X-API-KEY': Env.get('OPENSEA_API_KEY')
      }
    }

    return new Promise((resolve, reject) => {
      https.get(options, (resp) => {
        let data = '';

        // A chunk of data has been recieved.
        resp.on('data', (chunk) => {
          data += chunk;
        });

        // The whole response has been received. Print out the result.
        resp.on('end', () => {
          resolve(data);
        });

      }).on("error", (err) => {
        reject(err);
      });
    });
  };

}
