"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

/**
 * Qwikeer Admin Cancel Market Page
 *
 * Safe cancellation:
 * - only markets without trades can be cancelled
 * - open orders are cancelled/refunded
 * - positions are refunded at 50 cents per share
 * - market status becomes cancelled
 */

type Outcome = {
  id: string
  market_id: string
  code: string
  name: string
  sort_order: number
}

type AdminMarket = {
  id: string
  title: string
  description?: string | null
  category?: string | null
  status: string
  closes_at?: string | null
  resolved_outcome_id?: string | null
  resolution_note?: string | null
  created_at?: string | null
  outcomes: Outcome[]
}

type AdminMarketsResponse = {
  markets: AdminMarket[]
  error?: string
}

function statusClass(status: string) {
  if (status === "open") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200"
  }

  if (status === "paused") {
    return "bg-amber-50 text-amber-700 ring-amber-200"
  }

  if (status === "closed") {
    return "bg-slate-100 text-slate-700 ring-slate-200"
  }

  if (status === "resolved") {
    return "bg-blue-50 text-blue-700 ring-blue-200"
  }

  if (status === "cancelled") {
    return "bg-red-50 text-red-700 ring-red-200"
  }

  return "bg-slate-100 text-slate-700 ring-slate-200"
}

function formatMoneyFromCents(value: number) {
  return `${(Number(value || 0) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export default function CancelMarketPage() {
  const [markets, setMarkets] = useState<AdminMarket[]>([])
  const [selectedMarketId, setSelectedMarketId] = useState("")
  const [cancelNote, setCancelNote] = useState("")

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [canceling, setCanceling] = useState(false)

  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const cancellableMarkets = useMemo(() => {
    return markets.filter(
      (market) =>
        market.status !== "resolved" && market.status !== "cancelled"
    )
  }, [markets])

  const selectedMarket = useMemo(() => {
    return markets.find((market) => market.id === selectedMarketId) ?? null
  }, [markets, selectedMarketId])

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    return session?.access_token ?? null
  }

  async function fetchMarkets(options?: { silent?: boolean }) {
    try {
      if (options?.silent) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError("")

      const accessToken = await getAccessToken()

      if (!accessToken) {
        throw new Error("Please login first.")
      }

      const res = await fetch("/api/admin/markets", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      const contentType = res.headers.get("content-type") || ""

      if (!contentType.includes("application/json")) {
        const text = await res.text()
        console.error(
          "Non-JSON response from /api/admin/markets:",
          text.slice(0, 500)
        )
        throw new Error(
          `/api/admin/markets returned non-JSON response. Status: ${res.status}`
        )
      }

      const data: AdminMarketsResponse = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Could not load markets.")
      }

      const loadedMarkets = data.markets ?? []
      setMarkets(loadedMarkets)

      if (!selectedMarketId) {
        const first = loadedMarkets.find(
          (market) =>
            market.status !== "resolved" && market.status !== "cancelled"
        )

        if (first) {
          setSelectedMarketId(first.id)
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load markets.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function cancelMarket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setCanceling(true)
      setError("")
      setSuccess("")

      const accessToken = await getAccessToken()

      if (!accessToken) {
        throw new Error("Please login first.")
      }

      if (!selectedMarketId) {
        throw new Error("Please select a market.")
      }

      if (!selectedMarket) {
        throw new Error("Selected market not found.")
      }

      if (selectedMarket.status === "resolved") {
        throw new Error("Resolved markets cannot be cancelled.")
      }

      if (selectedMarket.status === "cancelled") {
        throw new Error("Market is already cancelled.")
      }

      const confirmed = window.confirm(
        `Cancel this market?\n\n${selectedMarket.title}\n\nThis will refund open orders and positions. This safe version only works if the market has no trades.`
      )

      if (!confirmed) return

      const res = await fetch("/api/admin/cancel-market", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          marketId: selectedMarketId,
          cancelNote,
        }),
      })

      const contentType = res.headers.get("content-type") || ""

      if (!contentType.includes("application/json")) {
        const text = await res.text()
        console.error(
          "Non-JSON response from /api/admin/cancel-market:",
          text.slice(0, 500)
        )
        throw new Error(
          `/api/admin/cancel-market returned non-JSON response. Status: ${res.status}`
        )
      }

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to cancel market.")
      }

      const orderRefunds = Number(data.result?.total_order_refunds_cents ?? 0)
      const positionRefunds = Number(
        data.result?.total_position_refunds_cents ?? 0
      )

      setSuccess(
        `Market cancelled. Order refunds: ${formatMoneyFromCents(
          orderRefunds
        )}, position refunds: ${formatMoneyFromCents(positionRefunds)}.`
      )

      setCancelNote("")
      setSelectedMarketId("")

      await fetchMarkets({ silent: true })
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to cancel market.")
    } finally {
      setCanceling(false)
    }
  }

  useEffect(() => {
    fetchMarkets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <main className="p-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">
            Loading cancel market tool...
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-600">
                Qwikeer Admin
              </p>

              <h1 className="mt-2 text-4xl font-black tracking-[-0.06em] text-slate-950 md:text-6xl">
                Cancel market
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Safely void a market that should not continue. This version
                blocks cancellation if trades already exist.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fetchMarkets({ silent: true })}
                disabled={refreshing}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>

              <Link
                href="/admin"
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
              >
                Back to admin
              </Link>
            </div>
          </div>
        </section>

        {/* Alerts */}
        {error && (
          <section className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
            {error}
          </section>
        )}

        {success && (
          <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-semibold text-emerald-700">
            {success}
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-[460px_1fr]">
          {/* Form */}
          <form
            onSubmit={cancelMarket}
            className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
              Cancel selected market
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Choose a market and provide a cancellation reason.
            </p>

            <label className="mt-5 block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Market
              </span>

              <select
                value={selectedMarketId}
                onChange={(event) => setSelectedMarketId(event.target.value)}
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
              >
                <option value="">Select market</option>

                {cancellableMarkets.map((market) => (
                  <option key={market.id} value={market.id}>
                    {market.title}
                  </option>
                ))}
              </select>
            </label>

            {selectedMarket && (
              <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Selected market
                </p>

                <h3 className="mt-2 text-lg font-black text-slate-950">
                  {selectedMarket.title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {selectedMarket.description || "No description provided."}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${statusClass(
                      selectedMarket.status
                    )}`}
                  >
                    {selectedMarket.status}
                  </span>

                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">
                    {selectedMarket.category || "General"}
                  </span>

                  {selectedMarket.outcomes.map((outcome) => (
                    <span
                      key={outcome.id}
                      className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200"
                    >
                      {outcome.code}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <label className="mt-5 block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Cancellation note
              </span>

              <textarea
                value={cancelNote}
                onChange={(event) => setCancelNote(event.target.value)}
                placeholder="Example: Market cancelled because the event was postponed and no valid resolution source is available."
                rows={5}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
              />
            </label>

            <button
              type="submit"
              disabled={canceling || !selectedMarketId}
              className="mt-6 w-full rounded-2xl bg-red-600 px-5 py-4 text-sm font-black text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {canceling ? "Cancelling market..." : "Cancel and refund market"}
            </button>
          </form>

          {/* Guide */}
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
              Safe cancellation rules
            </h2>

            <div className="mt-5 space-y-4 text-sm leading-6 text-slate-600">
              <p>
                <strong>1.</strong> This safe version only cancels markets with
                no trades.
              </p>

              <p>
                <strong>2.</strong> Open BUY orders are refunded from locked
                balance.
              </p>

              <p>
                <strong>3.</strong> YES/NO positions are refunded at 50¢ per
                share.
              </p>

              <p>
                <strong>4.</strong> Ledger entries use market_refund so every
                movement remains auditable.
              </p>

              <p>
                <strong>5.</strong> Markets with trades need a more advanced
                dispute/void system.
              </p>
            </div>

            <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold leading-6 text-amber-800">
              Do not manually edit wallets to cancel markets. Always use the
              cancellation RPC so wallet, position, order, and ledger records
              remain consistent.
            </div>
          </section>
        </section>
      </div>
    </main>
  )
}