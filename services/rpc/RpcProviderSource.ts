import { AbstractProvider } from 'ethers'

/*
 * Contract every third-party RPC vendor must follow so EnsService can fail over between
 * them. To add a vendor, subclass this in its own file and add it to the pool in ./index.ts.
 */
export abstract class RpcProviderSource {
  public abstract readonly name: string
  public abstract createProvider(): AbstractProvider
}
