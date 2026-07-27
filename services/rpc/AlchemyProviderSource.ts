import Env from '@ioc:Adonis/Core/Env'
import { AbstractProvider, AlchemyProvider } from 'ethers'
import { RpcProviderSource } from './RpcProviderSource'

export class AlchemyProviderSource extends RpcProviderSource {
  public readonly name = 'alchemy'

  public createProvider(): AbstractProvider {
    return new AlchemyProvider(Env.get('ENS_NETWORK', 'mainnet'), Env.get('ALCHEMY_API'))
  }
}
