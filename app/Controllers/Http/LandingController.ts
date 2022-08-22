// import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

import EnsService from '../../../services/EnsService'
import NftService from '../../../services/NftService'
import View from '@ioc:Adonis/Core/View'
const punycode = require('punycode/')

export default class LandingController {
  private mainHostingDomain = 'eth.xyz'
  private ensService = new EnsService()

  public async index({ request, params, response }) {
    let domainBeingAccessed = ''
    let domainToLookup = ''
    let rawDomain = ''

    // if ProxyHost is set, use that as domain for lookup
    if (request.header('Proxy-Host') !== undefined && request.header('Proxy-Host') !== '') {
      domainBeingAccessed = request.header('Proxy-Host')
      rawDomain = domainBeingAccessed
      rawDomain = rawDomain.replace('.localhost', '')
      domainBeingAccessed = decodeURI(this.punifyIfNeeded(domainBeingAccessed))
    } else {
      // else use actual host
      domainBeingAccessed = request.headers().host.split(':').shift()
      rawDomain = domainBeingAccessed
      rawDomain = rawDomain.replace('.localhost', '') + '.eth'
      domainBeingAccessed = decodeURI(this.punifyIfNeeded(domainBeingAccessed))
    }

    // if domain is eth.xyz or localhost
    if (domainBeingAccessed === this.mainHostingDomain || domainBeingAccessed === 'localhost') {
      // if domain set using path, use that
      if (typeof params.domainAsPath === 'string') {
        rawDomain = params.domainAsPath
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

    return await View.render('landing_index', {
      rawDomain: rawDomain,
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

  public async 404({ response }) {
    response.status(404)
    return await View.render('errors/not-found')
  }
}
