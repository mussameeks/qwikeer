"use client"

import { useEffect, useMemo, useState } from "react"
import { useLogin, usePrivy, useWallets } from "@privy-io/react-auth"
import { supabase } from "@/lib/supabase"
import { getQwikeerChainName } from "@/lib/chains"

/**
 * Web3 Wallet Card
 *
 * Shows:
 * - Privy login state
 * - embedded wallet address
 * - saved wallet status from Supabase
 *
 * This does not replace your existing wallet balance yet.
 */

type SavedWeb3Wallet = {
  id: string
  user_id: string
  provider: string
  chain: string
  embedded_wallet_address: string
  smart_account_address?: string | null
  is_primary: boolean
  created_at?: string
  updated_at?: string
}

function shortenAddress(address?: string | null) {
  if (!address) return "Not available"
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function Web3WalletCard() {
  const { ready, authenticated, user, logout } = usePrivy()
  const { login } = useLogin()
  const { wallets } = useWallets()

  const [savedWallet, setSavedWallet] = useState<SavedWeb3Wallet | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadingSaved, setLoadingSaved] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const embeddedWallet = useMemo(() => {
    return (
      wallets.find((wallet) => wallet.walletClientType === "privy") ??
      wallets[0] ??
      null
    )
  }, [wallets])

  const embeddedAddress = embeddedWallet?.address ?? ""

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    return session?.access_token ?? null
  }

  async function fetchSavedWallet() {
    try {
      setLoadingSaved(true)
      setError("")

      const accessToken = await getAccessToken()

      if (!accessToken) {
        return
      }

      const res = await fetch("/api/web3/wallet", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Could not load Web3 wallet.")
      }

      setSavedWallet(data.wallet ?? null)
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not load Web3 wallet."
      )
    } finally {
      setLoadingSaved(false)
    }
  }

  async function saveWallet() {
    try {
      setSaving(true)
      setError("")
      setSuccess("")

      if (!embeddedAddress) {
        throw new Error("No embedded wallet address found.")
      }

      const accessToken = await getAccessToken()

      if (!accessToken) {
        throw new Error("Please login to Qwikeer first.")
      }

      const res = await fetch("/api/web3/wallet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          embeddedWalletAddress: embeddedAddress,
          smartAccountAddress: null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Could not save Web3 wallet.")
      }

      setSuccess("Web3 wallet saved successfully.")
      await fetchSavedWallet()
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not save Web3 wallet."
      )
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    fetchSavedWallet()
  }, [])

  if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
    return (
      <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-sm font-semibold leading-6 text-amber-800">
        Privy is not configured. Add NEXT_PUBLIC_PRIVY_APP_ID to enable Web3
        embedded wallets.
      </section>
    )
  }

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-600">
            Web3 Wallet
          </p>

          <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-slate-950">
            Base wallet.
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            This wallet will later hold USDC and interact with Qwikeer smart
            contracts on {getQwikeerChainName()}.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!authenticated ? (
            <button
              type="button"
              disabled={!ready}
              onClick={login}
              className="rounded-2xl bg-[#FF7A1A] px-5 py-3 text-sm font-black text-white transition hover:bg-[#E85F00] disabled:opacity-60"
            >
              Connect Web3 Wallet
            </button>
          ) : (
            <button
              type="button"
              onClick={logout}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              Disconnect
            </button>
          )}

          {authenticated && embeddedAddress && (
            <button
              type="button"
              onClick={saveWallet}
              disabled={saving}
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save wallet"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
          {success}
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">
            Privy status
          </p>

          <p className="mt-3 text-lg font-black text-slate-950">
            {authenticated ? "Connected" : "Not connected"}
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">
            Embedded wallet
          </p>

          <p className="mt-3 break-all text-sm font-black text-slate-950">
            {embeddedAddress
              ? shortenAddress(embeddedAddress)
              : "Not generated yet"}
          </p>

          {embeddedAddress && (
            <p className="mt-2 break-all text-xs font-semibold text-slate-500">
              {embeddedAddress}
            </p>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">
            Saved in Qwikeer
          </p>

          <p className="mt-3 text-lg font-black text-slate-950">
            {loadingSaved
              ? "Checking..."
              : savedWallet
                ? "Saved"
                : "Not saved"}
          </p>

          {savedWallet && (
            <p className="mt-2 text-xs font-semibold text-slate-500">
              Chain: {savedWallet.chain}
            </p>
          )}
        </div>
      </div>

      {user?.email?.address && (
        <p className="mt-5 text-xs font-semibold text-slate-400">
          Privy email: {user.email.address}
        </p>
      )}
    </section>
  )
}