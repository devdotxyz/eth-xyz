// import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

import View from '@ioc:Adonis/Core/View'
import SetupService from '../../../services/SetupService'

export default class LandingController {
  public async index() {
    return await View.render('setup_index')
  }
  public async submit({ request }) {
    let viewData = {
      success: true,
      message: '',
    }

    try {
      if (request.body().robocheck !== 'no') {
        viewData.success = false
        viewData.message = 'No 🤖 allowed.'
      } else {
        let response = await SetupService.queueDomainSetup(request.body().domain)
        if (response.errors.length) {
          viewData.success = false
          viewData.message = `The domain you entered does not appear to be valid.`
        } else {
          viewData.message = `Domain queued successfully: ${response.domain}. Domains in queue ${response.domainsInQueue}. `
        }
      }
    } catch (exception) {
      viewData.success = false
      viewData.message = `An unexpected error occurred.`
    }

    return await View.render('setup_submit', viewData)
  }
}
