import Env from '@ioc:Adonis/Core/Env'
import Redis from "@ioc:Adonis/Addons/Redis";

export default class NftService {
  private CACHE_KEY_PREFIX = 'wallet-nfts-';

  private nft_data = [];

  async getNfts(ethWalletAddress) {

    if (Env.get('REDIS_ENABLED')) {
      let cachedRecord = await Redis.get(`${this.CACHE_KEY_PREFIX}${ethWalletAddress}`)
      if (cachedRecord) {
        return JSON.parse(cachedRecord)
      }
    }

    let v2Data = await this.loadV2Data(ethWalletAddress);
    
    v2Data = v2Data && await Promise.all(v2Data.map(async (asset)=> {

      let metadata = await this.loadMetadata(asset['metadata_url']);

      return {
        'id': asset['identifier'],
        'collection': asset['collection'],
        'asset_contract': asset['contract'],
        'token_standard': asset['token_standard'],
        'name': asset['name'],
        'description': asset['description'],
        'image_url': asset['image_url'],
        'metadata_url': asset['metadata_url'],
        'metadata': {
          ...metadata
        },
        'created_at': asset['created_at'],
        'updated_at': asset['updated_at'],
        'is_disabled': asset['is_disabled'],
        'is_nsfw': asset['is_nsfw']
      }
    }));

    if (Env.get('REDIS_ENABLED')) {
      let jsonString = JSON.stringify(v2Data);
      let cacheSeconds = Env.get('RESULT_CACHE_SECONDS');
      // roughly 1/2 mb worth of data
      if (jsonString && jsonString.length > 500000) {
        cacheSeconds = Env.get('RESULT_CACHE_SECONDS_LARGE_PROFILES')
      }
      await Redis.setex(`${this.CACHE_KEY_PREFIX}${ethWalletAddress}`, cacheSeconds, jsonString);
    }
    return v2Data;
  }

  async loadV2Data(ethWalletAddress, chain = 'ethereum', next = null, allData = []) {

    // https://api.opensea.io/v2/chain/{chain}/account/{address}/nfts
    const axios = require('axios')

    let url = `https://api.opensea.io/api/v2/chain/${chain}/account/${ethWalletAddress}/nfts`;
    if(next){
      url = url + `?next=${next}`
    }

    let headers = {
      'X-API-KEY': Env.get('OPENSEA_API_KEY')
    }

    try{
      let {data} = await axios.get(url, {'headers' : headers})

      allData.push(...data.nfts)

      // console.log('data', data);
      if (data.next) {
        console.log('next', data.next)
        return await this.loadV2Data(ethWalletAddress, chain, data.next, allData) 
      }

      return allData;
    } catch (error) {
      // console.error(error)
      return null;
    }

  }

  async loadMetadata(metadataUrl) {
    if(!this.isValidUrl(metadataUrl)){
      return null;
    }

    const axios = require('axios')

    try{
      let {data} = await axios.get(metadataUrl);

      let metadataObject = {
        external_link: data.external_url ?? null,
        animation_url: data.animation_url ?? null,
        image_original_url: data.image_url ?? null,
        created_by: data.created_by ?? null,
      };

      if(Object.values(metadataObject).every(item => item === null)){
        return null;
      }

      return metadataObject;
    } catch (error) {
      // console.error(error)
      return null;
    }
  }

  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (err) {
      return false;
    }
  }

  loadData(ethWalletAddress, offset) {
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
