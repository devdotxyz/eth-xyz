// import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

import EnsService from '../../../services/EnsService'
import NftService from '../../../services/NftService'
import Env from '@ioc:Adonis/Core/Env'
import Redis from '@ioc:Adonis/Addons/Redis'
import View from '@ioc:Adonis/Core/View'
const punycode = require('punycode/')

export default class LandingController {
  private CACHE_KEY_PREFIX = 'count-'
  private mainHostingDomain = 'eth.xyz'
  private ensService = new EnsService()

  public async index({ request, params, response }) {
    let domainBeingAccessed = ''
    let domainToLookup = ''

    // if ProxyHost is set, use that as domain for lookup
    if (request.header('Proxy-Host') !== undefined && request.header('Proxy-Host') !== '') {
      domainBeingAccessed = request.header('Proxy-Host')
      domainBeingAccessed = decodeURI(this.punifyIfNeeded(domainBeingAccessed))
    } else {
      // else use actual host
      domainBeingAccessed = request.headers().host.split(':').shift()
      domainBeingAccessed = decodeURI(this.punifyIfNeeded(domainBeingAccessed))
    }

    // if domain is eth.xyz or localhost
    if (domainBeingAccessed === this.mainHostingDomain || domainBeingAccessed === 'localhost') {
      // if domain set using path, use that
      if (typeof params.domainAsPath === 'string') {
        domainToLookup = decodeURI(this.punifyIfNeeded(params.domainAsPath))
        domainBeingAccessed = this.mainHostingDomain + '/' + domainToLookup
      } else {
        // if no domain set in path, return about page
        return await View.render('landing_about')
      }
    } else if (domainBeingAccessed.indexOf(this.mainHostingDomain) !== -1) {
      // if page is being accessed via fourth level domain (a.b.eth.xyz)
      let domainBeingAccessedParts = domainBeingAccessed.split('.')
      if (domainBeingAccessedParts.length > 3) {
        // redirect to a third level (b.eth.xyz) so we can use our ssl wildcard
        return response
          .redirect()
          .status(302)
          .toPath('https://' + domainBeingAccessedParts.slice(-3).join('.'))
      }
      // if we are using the main hosting subdomain, strip off eth.xyz for lookup
      domainToLookup = domainBeingAccessed.replace(`.${this.mainHostingDomain}`, '') + '.eth'
    } else {
      // else use the full hostname directly for lookup
      domainToLookup = domainBeingAccessed
    }

    domainToLookup = decodeURI(this.punifyIfNeeded(domainToLookup))

    // store domain accessed transaction, all async to avoid blocking
    if (Env.get('REDIS_ENABLED')) {
      // get date format YYYY-mm-dd and create redis key for today's date
      let date = new Date().toISOString().split('T')[0]
      let redisKey = `${this.CACHE_KEY_PREFIX}${date}`
      // set key for today's date and domain, only if it does not exist
      Redis.hsetnx(redisKey, domainToLookup, 0)
      // set expiration for this key
      Redis.expire(redisKey, Env.get('ANALYTICS_CACHE_SECONDS'))
      // increment count by 1
      Redis.hincrby(redisKey, domainToLookup, 1)
    }

    return await View.render('landing_index', {
      domainToLookup: domainToLookup,
      domainBeingAccessed: domainBeingAccessed,
    })
  }

  public async textRecords({ params }) {
    // if string starts with xn- then convert punycode, otherwise decode as typical
    const domain = decodeURI(this.punifyIfNeeded(params.domain))
    const records = await this.ensService.getTextRecords(domain)
    return {
      success: records !== null,
      data: records,
    }
  }

  private punifyIfNeeded(text) {
    if (text.startsWith('xn-')) {
      return punycode.toUnicode(text)
    } else {
      return text
    }
  }

  public async nfts({ params }) {
    const nftService = new NftService()
    const nfts = await nftService.getNfts(params.ethWallet)
    return {
      success: nfts !== null,
      data: nfts,
    }
  }

  public async clearProfileCache({ request }) {
    const domain = request.input('profile');
    const ensService = new EnsService();
    await ensService.clearProfileCache(domain)

    return {
      success: true,
    }

  }

  public async checkRouteForRedirect({request, params, response}) {
    const urlSegments = request.url().split('/')
    const route = urlSegments.slice(-1)[0]
    const env = Env.get('NODE_ENV').toLowerCase()
    const mainDomain = (env === 'production') ? this.mainHostingDomain : request.host()
    const routeTemplate = route.replace('-', '_')

    // Redirect if URL is [domain]/name.eth/[route] or [domain]/subdomain.name.eth/[route] but not [domain]/[route]
    // or, in Production only, if URL is name.[domain]/[route] but not [domain]/[route]
    if (urlSegments.length > 2 || (env === 'production' && urlSegments.length < 3 && request.host() !== this.mainHostingDomain)) {
      return response
        .redirect()
        .status(301)
        .toPath('https://' + mainDomain + '/' + route)
    } else {
      return await View.render(routeTemplate)
    }
  }

  public async 404({ response }) {
    response.status(404)
    return await View.render('errors/not-found')
  }
}
