"use client"

import { QueryClient } from "@tanstack/react-query"
import { createConfig, http } from "wagmi"
import { base, baseSepolia } from "wagmi/chains"
import { getDefaultQwikeerChain } from "@/lib/chains"

/**
 * Wagmi config for Qwikeer.
 *
 * ssr: true prevents common hydration mismatch issues in Next.js.
 */

export const queryClient = new QueryClient()

export const wagmiConfig = createConfig({
  chains: [baseSepolia, base],
  transports: {
    [baseSepolia.id]: http(
      process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"
    ),
    [base.id]: http(
      process.env.NEXT_PUBLIC_BASE_MAINNET_RPC_URL || "https://mainnet.base.org"
    ),
  },
  ssr: true,
})

export const defaultQwikeerChain = getDefaultQwikeerChain()