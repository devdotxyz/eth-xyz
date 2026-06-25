/**
 * EVM chains (ENSIP-11) that @ensdomains/address-encoder does NOT enumerate but that ENS
 * names set address records for. The ENS coin type for an EVM chain is `0x80000000 | chainId`.
 *
 * These supplement the coin types address-encoder already knows (all SLIP-44 coins + 18
 * named EVM chains such as OP/MATIC/ARB1); `EnsService.getAllAddresses` queries the union.
 *
 * Chain IDs are verified against https://chainid.network (the ethereum-lists/chains registry)
 * and are immutable per EIP-155 — existing entries never change or get reassigned, so the only
 * maintenance is adding a new chain here when one gains ENS adoption. To support a chain, add a
 * `{ chainId, name }` row; the name is used for display when address-encoder has none.
 */
export interface EvmChain {
  chainId: number
  name: string
}

export const EXTRA_EVM_CHAINS: EvmChain[] = [
  { chainId: 0, name: 'Default EVM' }, // ENSIP-11 reserved default EVM address
  { chainId: 8453, name: 'Base' },
  { chainId: 7777777, name: 'Zora' },
  { chainId: 59144, name: 'Linea' },
  { chainId: 534352, name: 'Scroll' },
  { chainId: 81457, name: 'Blast' },
  { chainId: 5000, name: 'Mantle' },
  { chainId: 34443, name: 'Mode' },
  { chainId: 324, name: 'zkSync Era' },
  { chainId: 1101, name: 'Polygon zkEVM' },
  { chainId: 169, name: 'Manta Pacific' },
  { chainId: 1284, name: 'Moonbeam' },
  { chainId: 1285, name: 'Moonriver' },
  { chainId: 1313161554, name: 'Aurora' },
  { chainId: 288, name: 'Boba' },
  { chainId: 1088, name: 'Metis' },
  { chainId: 204, name: 'opBNB' },
  { chainId: 252, name: 'Fraxtal' },
  { chainId: 480, name: 'World Chain' },
  { chainId: 1135, name: 'Lisk' },
  { chainId: 60808, name: 'BOB' },
  { chainId: 42170, name: 'Arbitrum Nova' },
]

export const EVM_COIN_TYPE_BASE = 0x80000000

/** coinType -> chain name, for the chains listed above. */
export const EXTRA_EVM_NAME_BY_COIN_TYPE: Map<number, string> = new Map(
  EXTRA_EVM_CHAINS.map((chain) => [EVM_COIN_TYPE_BASE + chain.chainId, chain.name])
)
