// import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

import View from '@ioc:Adonis/Core/View'
import SetupService from "../../../services/SetupService";
import {inspect} from "util";

export default class LandingController {
  public async index() {
    return await View.render('setup_index')
  }
  public async submit({ request }) {
    try {
      let response = await SetupService.queueDomainSetup(request.body().domain)
      if (response.errors.length) {
        return `Errors: ${JSON.stringify(response.errors)}`
      } else {
        return `Domain queued successfully: ${response.domain}. \r\nDomains in queue ${response.domainsInQueue}. `
      }
    } catch (exception) {
      return inspect(exception)
    }
  }

}
