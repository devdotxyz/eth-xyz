import Env from '@ioc:Adonis/Core/Env'
import Redis from "@ioc:Adonis/Addons/Redis";
import EnsService from './EnsService'
import axios from 'axios'

export default class NftService {
  private CACHE_KEY_PREFIX = 'wallet-nfts-'

  private CHAINS = [
    'ethereum',
    'matic', // polygon matic
  ]

  private IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.gif', '.png', '.svg']

  public async doNftsExist(domain) {
    let ensService = new EnsService()
    let addresses = await ensService.getAllDomainAddresses(domain)

    let nftsExist = false
    //foreach address get nfts
    let nfts = {}
    addresses && await Promise.all(
      Object.keys(addresses).map(async (key) => {
        console.log('value', addresses[key])
        ;(await this.checkV2Data(addresses[key].value)) ? (nftsExist = true) : null
      })
    )
    return nftsExist
  }

  public async getDomainNfts(domain) {
    console.log('getDomainNfts')
    let ensService = new EnsService()
    let addresses = await ensService.getAllDomainAddresses(domain)

    console.log('addresses', addresses)
    //foreach address get nfts
    let nfts = {}
    await Promise.all(
      Object.keys(addresses).map(async (key) => {
        let nftData = await this.getNfts(addresses[key].value)
        if (nftData.length) {
          nfts = [...nftData]
        }
      })
    )
    return nfts
  }

  public async getMetadata(url) {
    const axios = require('axios')

    // check if metadata url is a ipfs link (contains ipfs:// as the first characters)
    let metadataUrl = url
    if (metadataUrl.slice(0, 7) === 'ipfs://') {
      // remove ipfs from the url
      metadataUrl = metadataUrl.slice(7)
      metadataUrl = 'https://ipfs.io/ipfs/' + metadataUrl
    }

    try {
      let {data} = await axios.get(metadataUrl);
      return data
    } catch (error) {
      // console.error(error)
      return null
    }
  }

  async getNfts(ethWalletAddress) {

    if (Env.get('REDIS_ENABLED')) {
      let cachedRecord = await Redis.get(`${this.CACHE_KEY_PREFIX}${ethWalletAddress}`)
      if (cachedRecord) {
        return JSON.parse(cachedRecord)
      }
    }

    // // let v2Data
    // this.CHAINS.map(async (chain) => {
    //   await this.loadV2Data(ethWalletAddress, chain);
    // })

    let v2Data = [];

    await Promise.all(this.CHAINS.map(async (chain) => {
      let chainData = await this.loadV2Data(ethWalletAddress, chain);
      if(chainData){
        // console.log('chainData', chainData);
        v2Data.push(...chainData);
      }
    }));

    // remove all opensea-paymentassets collection
    v2Data = v2Data.filter((asset) => {
      return asset['collection'] !== 'opensea-paymentassets';
    });

    v2Data =
      v2Data &&
      (await Promise.all(
        v2Data.map(async (asset) => {
          return {
            id: asset['identifier'],
            collection: asset['collection'],
            asset_contract: asset['contract'],
            token_standard: asset['token_standard'],
            name: asset['name'],
            description: asset['description'],
            image_url: asset['image_url'],
            metadata_url: asset['metadata_url'],
            created_at: asset['created_at'],
            updated_at: asset['updated_at'],
            is_disabled: asset['is_disabled'],
            is_nsfw: asset['is_nsfw'],
            chain: asset['chain'],
            image_type: this.checkNftImageType(asset['image_url']),
          }
        })
      ))

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

  // used in OpenSea v2 API
  private checkNftImageType(image_url) {
    let imageType = 'image'
    const nftSources = [
      'artblocks.io',
      'arweave.net',
      'ethblock.art',
      'ether.cards',
      'etherheads.io',
      'ethouses.io',
      'everyicon.xyz',
      'pinata.cloud',
      'ipfs.io',
      'stickynft.com',
      'vxviewer.vercel.app',
    ]
    nftSources.forEach((source, index) => {
      if (image_url && image_url.includes(source)) {
        imageType = 'nonstandard'
      }
    })

    if (image_url !== null && (image_url.slice(-4) === '.glb' || image_url.slice(-5) === '.gltf')) {
      imageType = '3d'
    } else if (
      image_url !== null &&
      (image_url.slice(-4) === '.mp4' || image_url.slice(-4) === '.mov')
    ) {
      imageType = 'video'
    } else if (image_url !== null && image_url.slice(-4) === '.mp3') {
      imageType = 'audio'
    } else {
      this.IMAGE_EXTENSIONS.forEach((source, index) => {
        if (image_url && image_url.includes(source)) {
          imageType = 'image'
        }
      })
    }

    return imageType
  }

  private async checkV2Data(ethWalletAddress, chain = 'ethereum') {
    // https://api.opensea.io/v2/chain/{chain}/account/{address}/nfts
    const axios = require('axios')

    let url = `https://api.opensea.io/api/v2/chain/${chain}/account/${ethWalletAddress}/nfts?limit=1`

    let headers = {
      'X-API-KEY': Env.get('OPENSEA_API_KEY'),
    }

    let nftsExist = false;

    try {
      let { data } = await axios.get(url, { headers: headers })
      nftsExist = data.nfts.length > 0
    } catch (error) {
      // console.error(error)
      return nftsExist
    }
    return nftsExist
  }

  private async loadV2Data(ethWalletAddress, chain = 'ethereum', next = null, allData = []) {
    // https://api.opensea.io/v2/chain/{chain}/account/{address}/nfts
    const axios = require('axios')

    let url = `https://api.opensea.io/api/v2/chain/${chain}/account/${ethWalletAddress}/nfts`
    if (next) {
      url = url + `?next=${next}`
    }

    let headers = {
      'X-API-KEY': Env.get('OPENSEA_API_KEY'),
    }

    try {
      let { data } = await axios.get(url, {'headers' : headers})

      // console.log('data', data);
      data.nfts = data.nfts.map((asset) => {
        return {
          ...asset,
          chain: chain,
        }
      })

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

  async loadNftData(chain, contract, identifier) {
    const axios = require('axios')

    const nftUrl = `https://api.opensea.io/api/v2/chain/${chain}/contract/${contract}/nfts/${identifier}`;
    let headers = {
      'X-API-KEY': Env.get('OPENSEA_API_KEY')
    }

    try{
      let {data} = await axios.get(nftUrl, {'headers' : headers});

      console.log('nftdata', data);

      return data;
    } catch (error) {
      // console.error(error)
      return null;
    }
  }

  async loadMetadata(metadataUrl) {

    const defaultMetadata = {
      external_link: null,
      animation_url: null,
      animation_original_url: null,
      image_original_url: null,
      created_by: null,
    }
    if(!this.isValidUrl(metadataUrl)){
      return defaultMetadata;
    }

    const axios = require('axios')

    try{
      let {data} = await axios.get(metadataUrl);

        defaultMetadata.external_link = data.external_url ?? null;
        defaultMetadata.animation_url = data.animation_url ?? null;
        defaultMetadata.animation_original_url = data.animation_url ?? null;
        defaultMetadata.image_original_url = data.image_url ?? null;
        defaultMetadata.created_by = data.created_by ?? null;

      return defaultMetadata;
    } catch (error) {
      // console.error(error)
      return defaultMetadata;
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
