import Env from '@ioc:Adonis/Core/Env'
import Redis from "@ioc:Adonis/Addons/Redis";

export default class NftService {
  private CACHE_KEY_PREFIX = 'wallet-nfts-';

  async getNfts(ethWalletAddress) {

    if (Env.get('REDIS_ENABLED')) {
      let cachedRecord = await Redis.get(`${this.CACHE_KEY_PREFIX}${ethWalletAddress}`)
      if (cachedRecord) {
        return JSON.parse(cachedRecord)
      }
    }

    let response = [];
    let responseStep = ['a'];
    let offset = 0;

    do {
      let responseStep = await this.loadData(ethWalletAddress, offset).then(response => {
        return JSON.parse(<string>response).assets;
      });
      response = response.concat(responseStep);
      offset += 50;

      // Not really sure why I need to explicitly break, but apparently I do
      if(responseStep.length == 0) {
        break;
      }
    } while (responseStep.length > 0);

    if (Env.get('REDIS_ENABLED')) {
      let jsonString = JSON.stringify(response);
      let cacheSeconds = Env.get('RESULT_CACHE_SECONDS');
      // roughly 1/2 mb worth of data
      if(jsonString && jsonString.length > 500000){
        cacheSeconds = Env.get('RESULT_CACHE_SECONDS_LARGE_PROFILES')
      }
      await Redis.setex(`${this.CACHE_KEY_PREFIX}${ethWalletAddress}`, cacheSeconds, jsonString);
    }
    return response;
  }

  loadData(ethWalletAddress, offset) {
    let https = require('https');
    let options = {
      hostname: 'api.opensea.io',
      port: 443,
      path: `/api/v1/assets?owner=${ethWalletAddress}&order_direction=desc&offset=${offset}&limit=50`,
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
