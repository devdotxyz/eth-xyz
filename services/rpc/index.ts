import { RpcProviderSource } from './RpcProviderSource'
import { InfuraProviderSource } from './InfuraProviderSource'
import { AlchemyProviderSource } from './AlchemyProviderSource'

export { RpcProviderSource, InfuraProviderSource, AlchemyProviderSource }

/*
 * Random order per visit: the first vendor gets the request, the other is the fallback.
 * Randomizing spreads load across both vendors' quotas. A coin flip is only uniform for
 * two vendors — if the pool grows, replace this with a real shuffle (Fisher–Yates).
 */
export function providerFailoverOrder(): RpcProviderSource[] {
  const sources = [new InfuraProviderSource(), new AlchemyProviderSource()]
  return Math.random() < 0.5 ? sources : sources.reverse()
}
