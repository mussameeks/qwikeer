"use client"

import { PrivyProvider } from "@privy-io/react-auth"
import { QueryClientProvider } from "@tanstack/react-query"
import { WagmiProvider } from "wagmi"
import { defaultQwikeerChain } from "@/lib/wagmi"
import { queryClient, wagmiConfig } from "@/lib/wagmi"

/**
 * Qwikeer Web3 Provider
 *
 * Adds:
 * - Privy embedded wallet support
 * - Wagmi chain config
 * - React Query provider
 *
 * Keep this client-only.
 */

export function Web3Provider({ children }: { children: React.ReactNode }) {
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID

  if (!privyAppId) {
    return <>{children}</>
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        appearance: {
          theme: "light",
          accentColor: "#FF7A1A",
          logo: "/favicon.ico",
        },
        loginMethods: ["email", "google"],
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
        },
        defaultChain: defaultQwikeerChain,
        supportedChains: wagmiConfig.chains,
      }}
    >
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    </PrivyProvider>
  )
}