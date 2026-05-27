"use client"

import * as React from "react"
import { PrivyProvider } from "@privy-io/react-auth"
import { createConfig, WagmiProvider } from "@privy-io/wagmi"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { http } from "wagmi"
import { base, baseSepolia } from "viem/chains"

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID

const defaultQwikeerChain =
  process.env.NEXT_PUBLIC_QWIKEER_CHAIN === "base-mainnet"
    ? base
    : baseSepolia

const wagmiConfig = createConfig({
  chains: [base, baseSepolia],
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL),
    [baseSepolia.id]: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL),
  },
})

const queryClient = new QueryClient()

export function Web3Provider({ children }: { children: React.ReactNode }) {
  if (!privyAppId) {
    throw new Error(
      "Missing NEXT_PUBLIC_PRIVY_APP_ID. Add it to your .env.local and Vercel Environment Variables."
    )
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: ["email", "google"],

        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },

        defaultChain: defaultQwikeerChain,
        supportedChains: wagmiConfig.chains,

        appearance: {
          theme: "light",
          accentColor: "#111827",
          logo: "/logo.png",
          walletList: [
            "metamask",
            "coinbase_wallet",
            "wallet_connect",
            "base_account",
            "embedded",
          ],
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  )
}
