"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

/**
 * Qwikeer Admin Liquidity Page
 *
 * Purpose:
 * - Add test liquidity to a market.
 * - Make orderbook show bids/asks quickly.
 * - Help test matching with a second user account.
 *
 * Important:
 * - The same user cannot match against their own order.
 * - Use admin as liquidity account, and a separate normal user for test trades.
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

function formatMoneyFromCents(value: number) {
  return `${(Number(value || 0) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function statusClass(status: string) {
  if (status === "open") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200"
  }

  if (status === "resolved") {
    return "bg-blue-50 text-blue-700 ring-blue-200"
  }

  if (status === "paused") {
    return "bg-amber-50 text-amber-700 ring-amber-200"
  }

  return "bg-slate-100 text-slate-700 ring-slate-200"
}

export default function AdminLiquidityPage() {
  const [markets, setMarkets] = useState<AdminMarket[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [selectedMarketId, setSelectedMarketId] = useState("")
  const [selectedOutcomeId, setSelectedOutcomeId] = useState("")
  const [side, setSide] = useState<"buy" | "sell">("sell")
  const [priceCents, setPriceCents] = useState("60")
  const [quantity, setQuantity] = useState("100")
  const [autoFund, setAutoFund] = useState(true)

  const [creating, setCreating] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const openMarkets = useMemo(() => {
    return markets.filter((market) => market.status === "open")
  }, [markets])

  const selectedMarket = useMemo(() => {
    return markets.find((market) => market.id === selectedMarketId) ?? null
  }, [markets, selectedMarketId])

  const selectedOutcome = useMemo(() => {
    return (
      selectedMarket?.outcomes.find(
        (outcome) => outcome.id === selectedOutcomeId
      ) ?? null
    )
  }, [selectedMarket, selectedOutcomeId])

  const estimatedOrderValueCents = useMemo(() => {
    return Number(priceCents || 0) * Number(quantity || 0)
  }, [priceCents, quantity])

  const estimatedMintCostCents = useMemo(() => {
    return side === "sell" ? Number(quantity || 0) * 100 : 0
  }, [side, quantity])

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
        setMarkets([])
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
        const firstOpen = loadedMarkets.find(
          (market) => market.status === "open"
        )

        if (firstOpen) {
          setSelectedMarketId(firstOpen.id)

          const firstOutcome =
            firstOpen.outcomes.find(
              (outcome) => String(outcome.code).toUpperCase() === "YES"
            ) ?? firstOpen.outcomes[0]

          setSelectedOutcomeId(firstOutcome?.id ?? "")
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load markets.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  function handleSelectMarket(marketId: string) {
    setSelectedMarketId(marketId)

    const market = markets.find((item) => item.id === marketId)

    const firstOutcome =
      market?.outcomes.find(
        (outcome) => String(outcome.code).toUpperCase() === "YES"
      ) ?? market?.outcomes?.[0]

    setSelectedOutcomeId(firstOutcome?.id ?? "")
  }

  async function createLiquidity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setCreating(true)
      setError("")
      setSuccess("")

      const accessToken = await getAccessToken()

      if (!accessToken) {
        throw new Error("Please login first.")
      }

      if (!selectedMarketId) {
        throw new Error("Please select a market.")
      }

      if (!selectedOutcomeId) {
        throw new Error("Please select an outcome.")
      }

      const price = Number(priceCents)
      const qty = Number(quantity)

      if (!Number.isInteger(price) || price < 1 || price > 99) {
        throw new Error("Price must be an integer between 1 and 99 cents.")
      }

      if (!Number.isInteger(qty) || qty <= 0) {
        throw new Error("Quantity must be a positive integer.")
      }

      const res = await fetch("/api/admin/liquidity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          marketId: selectedMarketId,
          outcomeId: selectedOutcomeId,
          side,
          priceCents: price,
          quantity: qty,
          autoFund,
        }),
      })

      const contentType = res.headers.get("content-type") || ""

      if (!contentType.includes("application/json")) {
        const text = await res.text()
        console.error(
          "Non-JSON response from /api/admin/liquidity:",
          text.slice(0, 500)
        )
        throw new Error(
          `/api/admin/liquidity returned non-JSON response. Status: ${res.status}`
        )
      }

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to create liquidity.")
      }

      setSuccess(
        `${side.toUpperCase()} liquidity created: ${qty} ${
          selectedOutcome?.code ?? ""
        } @ ${price}¢.`
      )

      await fetchMarkets({ silent: true })
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to create liquidity."
      )
    } finally {
      setCreating(false)
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
            Loading liquidity tool...
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
                Liquidity tool
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Create test market-maker orders so Qwikeer markets show bids and
                asks during development.
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
          {/* Liquidity form */}
          <form
            onSubmit={createLiquidity}
            className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
              Create liquidity order
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Admin account will act as the test market maker.
            </p>

            <label className="mt-5 block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Market
              </span>

              <select
                value={selectedMarketId}
                onChange={(event) => handleSelectMarket(event.target.value)}
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
              >
                <option value="">Select market</option>

                {openMarkets.map((market) => (
                  <option key={market.id} value={market.id}>
                    {market.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-4 block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Outcome
              </span>

              <select
                value={selectedOutcomeId}
                onChange={(event) => setSelectedOutcomeId(event.target.value)}
                disabled={!selectedMarket}
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">Select outcome</option>

                {(selectedMarket?.outcomes ?? []).map((outcome) => (
                  <option key={outcome.id} value={outcome.id}>
                    {outcome.code} — {outcome.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {(["buy", "sell"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSide(value)}
                  className={`rounded-2xl px-4 py-3 text-sm font-black capitalize transition ${
                    side === value
                      ? "bg-slate-950 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Price, cents
                </span>

                <input
                  value={priceCents}
                  onChange={(event) => setPriceCents(event.target.value)}
                  inputMode="numeric"
                  placeholder="60"
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />
              </label>

              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Quantity
                </span>

                <input
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  inputMode="numeric"
                  placeholder="100"
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />
              </label>
            </div>

            <label className="mt-5 flex items-start gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <input
                type="checkbox"
                checked={autoFund}
                onChange={(event) => setAutoFund(event.target.checked)}
                className="mt-1"
              />

              <span>
                <span className="block text-sm font-black text-slate-950">
                  Auto fund admin account
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  Recommended for testing. BUY liquidity gets cash. SELL
                  liquidity gets cash for minting complete sets.
                </span>
              </span>
            </label>

            <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Order side</span>
                <span className="font-black uppercase">{side}</span>
              </div>

              <div className="mt-3 flex justify-between">
                <span className="text-slate-500">Outcome</span>
                <span className="font-black">
                  {selectedOutcome?.code ?? "—"}
                </span>
              </div>

              <div className="mt-3 flex justify-between">
                <span className="text-slate-500">Order value</span>
                <span className="font-black">
                  {formatMoneyFromCents(estimatedOrderValueCents)}
                </span>
              </div>

              {side === "sell" && (
                <div className="mt-3 flex justify-between">
                  <span className="text-slate-500">Mint cost</span>
                  <span className="font-black">
                    {formatMoneyFromCents(estimatedMintCostCents)}
                  </span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={creating || !selectedMarketId || !selectedOutcomeId}
              className="mt-6 w-full rounded-2xl bg-[#FF7A1A] px-5 py-4 text-sm font-black text-white shadow-sm transition hover:bg-[#E85F00] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? "Creating liquidity..." : "Create liquidity order"}
            </button>
          </form>

          {/* Guide */}
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
              How to test liquidity
            </h2>

            <div className="mt-5 space-y-4 text-sm leading-6 text-slate-600">
              <p>
                <strong>SELL liquidity:</strong> Creates asks in the orderbook.
                A normal user can then BUY against those asks.
              </p>

              <p>
                <strong>BUY liquidity:</strong> Creates bids in the orderbook.
                A normal user can then SELL into those bids after minting
                complete sets.
              </p>

              <p>
                <strong>Self-match protection:</strong> The same account cannot
                trade against its own order. This is good for production and
                prevents fake volume.
              </p>

              <p>
                <strong>Best test flow:</strong> use admin account to create
                liquidity, then use another normal account to place trades.
              </p>
            </div>

            <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold leading-6 text-amber-800">
              This tool is for development/testing liquidity. Later, for
              production, we should separate real market making from admin tools
              and add stricter audit controls.
            </div>

            {selectedMarket && (
              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
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

                <div className="mt-5">
                  <Link
                    href={`/markets/${selectedMarket.id}`}
                    className="inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
                  >
                    Open market
                  </Link>
                </div>
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  )
}