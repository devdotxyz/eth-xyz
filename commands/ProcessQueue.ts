import { BaseCommand } from '@adonisjs/core/build/standalone'
import SetupService from '../services/SetupService'

export default class ProcessQueue extends BaseCommand {
  /**
   * Command name is used to run the command
   */
  public static commandName = 'process:queue'

  /**
   * Command description is displayed in the "help" output
   */
  public static description = 'Process the domain registration queue'

  public static settings = {
    /**
     * Set the following value to true, if you want to load the application
     * before running the command
     */
    loadApp: true,

    /**
     * Set the following value to true, if you want this command to keep running until
     * you manually decide to exit the process
     */
    stayAlive: false,
  }

  public async run() {
    let domainsInQueue = await SetupService.getDomainQueueCount()
    console.log(`${domainsInQueue} domains in queue.`)
    let domain
    do {
      domain = await SetupService.getDomainFromQueue()
      if (domain !== null) {
        console.log(`processing ${domain}`)
        await SetupService.processDomainSetup(domain)
      }
    } while (domain !== null)
  }
}
