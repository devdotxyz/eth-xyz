// import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

import EnsService from '../../../services/EnsService'
import NftService from '../../../services/NftService'
import View from '@ioc:Adonis/Core/View'

export default class LandingController {
  private xyzDomainSuffix = 'eth.xyz'
  private ensService = new EnsService()
  private defaultDomain = 'brantly.eth'

  public async index({ request, params }) {
    let domain = this.defaultDomain

    // try to get domain from actual hostname
    let hostDomain = request.headers().host.split(':').shift()

    if (request.header('Proxy-Host') !== undefined && request.header('Proxy-Host') !== '') {
      domain = request.header('Proxy-Host')
    } else if (hostDomain !== 'localhost' && request.headers().host.indexOf(this.xyzDomainSuffix) !== -1) {
      domain = hostDomain.replace(`.${this.xyzDomainSuffix}`, '')
      domain = `${domain}.eth`
    } else if (typeof params.domain === 'string') {
      domain = params.domain
    }

    // process domain to get parts
    let sld = domain.split('.').shift()
    let xyzDomain = `${sld}.${this.xyzDomainSuffix}`

    return await View.render('landing_index', {
      domain: domain,
      xyzDomain: xyzDomain,
    })
  }

  public async textRecords({ params }) {
    const records = await this.ensService.getTextRecords(params.domain)
    return {
      success: records !== null,
      data: records,
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
