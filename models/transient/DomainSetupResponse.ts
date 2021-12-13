export default class DomainSetupResponse {
  public domain: string | null
  public domainsInQueue: number
  public errors: string[]

  constructor(domain, domainsInQueue, errors) {
    this.domain = domain
    this.domainsInQueue = domainsInQueue
    this.errors = errors
  }
}
