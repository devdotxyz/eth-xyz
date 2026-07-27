import Env from '@ioc:Adonis/Core/Env'
import { AbstractProvider, InfuraProvider } from 'ethers'
import { RpcProviderSource } from './RpcProviderSource'

export class InfuraProviderSource extends RpcProviderSource {
  public readonly name = 'infura'

  public createProvider(): AbstractProvider {
    return new InfuraProvider(
      Env.get('ENS_NETWORK', 'mainnet'),
      Env.get('INFURA_PROJECT_ID'),
      Env.get('INFURA_PROJECT_SECRET')
    )
  }
}
