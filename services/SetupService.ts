import Env from '@ioc:Adonis/Core/Env'
import Redis from '@ioc:Adonis/Addons/Redis'
import { schema, rules, validator, ValidationException } from '@ioc:Adonis/Core/Validator'
import DomainSetupResponse from '../models/transient/DomainSetupResponse'

export default class SetupService {
  private static CACHE_QUEUE_KEY = 'domain-queue'
  private static CACHE_RESULT_PREFIX = 'domain-result-'

  public static async queueDomainSetup(domain: string | undefined): Promise<DomainSetupResponse> {
    let errors: string[] = []
    let domainsInQueue = 0
    try {
      // Basic sanitization
      if (domain === undefined) {
        throw new Error('Domain is undefined')
      }

      domain = domain.replace(/(^\w+:|^)\/\//, '') // Remove protocol
      domain = domain.split('/').shift() // Remove any paths that were submitted

      // Run more comprehensive validation
      await validator.validate({
        schema: schema.create({
          domain: schema.string({}, [rules.url()]),
        }),
        data: {
          domain: domain,
        },
      })

      await Redis.sadd(this.CACHE_QUEUE_KEY, domain)
      domainsInQueue = await this.getDomainQueueCount()
    } catch (e) {
      if (e instanceof ValidationException) {
        errors = e.messages.domain
      } else {
        errors = [`Unknown exception: ${e}`]
      }
    }
    return new DomainSetupResponse(domain, domainsInQueue, errors)
  }

  public static async getDomainQueueCount(): Promise<number> {
    return await Redis.scard(this.CACHE_QUEUE_KEY)
  }

  public static async getDomainFromQueue(): Promise<string | null> {
    return await Redis.spop(this.CACHE_QUEUE_KEY)
  }

  public static async processDomainSetup(domain: string): Promise<void> {
    const { exec } = require('child_process')

    exec(`sudo certbot --nginx -d ${domain} -n`, (error, stdout, stderr) => {
      if (error) {
        Redis.setex(`${this.CACHE_RESULT_PREFIX}${domain}`, Env.get('RESULT_CACHE_SECONDS'), error)
        return
      }
      if (stderr) {
        Redis.setex(`${this.CACHE_RESULT_PREFIX}${domain}`, Env.get('RESULT_CACHE_SECONDS'), stderr)
        return
      }
      Redis.setex(`${this.CACHE_RESULT_PREFIX}${domain}`, Env.get('RESULT_CACHE_SECONDS'), stdout)
    })
  }
}
