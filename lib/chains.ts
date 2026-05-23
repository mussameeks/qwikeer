import { base, baseSepolia } from "wagmi/chains"

/**
 * Qwikeer Web3 chain config.
 *
 * Development:
 * - Base Sepolia
 *
 * Production:
 * - Base mainnet
 */

export const qwikeerChains = [baseSepolia, base] as const

export function getDefaultQwikeerChain() {
  const configuredChain = process.env.NEXT_PUBLIC_WEB3_CHAIN

  if (configuredChain === "base") {
    return base
  }

  return baseSepolia
}

export function getQwikeerChainName() {
  const chain = getDefaultQwikeerChain()

  return chain.name
}

export function getQwikeerChainId() {
  const chain = getDefaultQwikeerChain()

  return chain.id
}

export function toQwikeerDbChain() {
  const chain = getDefaultQwikeerChain()

  if (chain.id === base.id) {
    return "base"
  }

  return "base_sepolia"
}