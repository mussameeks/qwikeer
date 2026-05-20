"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

/**
 * Qwikeer Market Detail Page
 *
 * Supports:
 * - market detail
 * - YES/NO selector
 * - buy/sell limit orders
 * - complete set minting
 * - orderbook display
 * - recent trades
 */

type Outcome = {
  id: string
  market_id: string
  code: string
  name: string
  sort_order: number
}

type Trade = {
  id: string
  market_id: string
  outcome_id: string
  price_cents: number
  quantity: number
  created_at: string
}

type Market = {
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
  trades: Trade[]
  yesPrice: number
  noPrice: number
  volumeCents: number
}

type OrderbookLevel = {
  priceCents: number
  quantity: number
  valueCents: number
}

type OrderbookResponse = {
  bids: OrderbookLevel[]
  asks: OrderbookLevel[]
  bestBid?: OrderbookLevel | null
  bestAsk?: OrderbookLevel | null
  error?: string
}

function formatMoneyFromCents(value: number) {
  return `${(Number(value || 0) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatDate(value?: string | null) {
  if (!value) return "Open"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return "Open"

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not available"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return "Not available"

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function MarketDetailPage() {
  const params = useParams()
  const marketId = String(params?.id || "")

  const [market, setMarket] = useState<Market | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [selectedCode, setSelectedCode] = useState<"YES" | "NO">("YES")
  const [side, setSide] = useState<"buy" | "sell">("buy")
  const [priceCents, setPriceCents] = useState("50")
  const [quantity, setQuantity] = useState("10")
  const [placing, setPlacing] = useState(false)

  const [mintQuantity, setMintQuantity] = useState("10")
  const [minting, setMinting] = useState(false)

  const [bids, setBids] = useState<OrderbookLevel[]>([])
  const [asks, setAsks] = useState<OrderbookLevel[]>([])
  const [bestBid, setBestBid] = useState<OrderbookLevel | null>(null)
  const [bestAsk, setBestAsk] = useState<OrderbookLevel | null>(null)
  const [orderbookLoading, setOrderbookLoading] = useState(false)

  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const selectedOutcome = useMemo(() => {
    return market?.outcomes.find(
      (outcome) =>
        String(outcome.code).toUpperCase() === selectedCode.toUpperCase()
    )
  }, [market, selectedCode])

  const totalOrderValueCents = useMemo(() => {
    return Number(priceCents || 0) * Number(quantity || 0)
  }, [priceCents, quantity])

  const mintCostCents = useMemo(() => {
    return Number(mintQuantity || 0) * 100
  }, [mintQuantity])

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    return session?.access_token ?? null
  }

  async function fetchMarket(options?: { silent?: boolean }) {
    try {
      if (options?.silent) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError("")

      const res = await fetch(`/api/markets/${marketId}`)
      const contentType = res.headers.get("content-type") || ""

      if (!contentType.includes("application/json")) {
        const text = await res.text()
        console.error("Non-JSON response from /api/markets/[id]:", text.slice(0, 500))
        throw new Error(`/api/markets/${marketId} returned non-JSON response. Status: ${res.status}`)
      }

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Could not load market.")
      }

      const loadedMarket: Market = {
        ...data,
        outcomes: data.outcomes ?? [],
        trades: data.trades ?? [],
        yesPrice: Number(data.yesPrice ?? 50),
        noPrice: Number(data.noPrice ?? 50),
        volumeCents: Number(data.volumeCents ?? 0),
      }

      setMarket(loadedMarket)

      const defaultPrice =
        selectedCode === "YES"
          ? Number(loadedMarket.yesPrice ?? 50)
          : Number(loadedMarket.noPrice ?? 50)

      setPriceCents(String(defaultPrice))
    } catch (error) {
      setMarket(null)
      setError(error instanceof Error ? error.message : "Could not load market.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function fetchOrderbook(outcomeId?: string) {
    try {
      if (!marketId || !outcomeId) {
        setBids([])
        setAsks([])
        setBestBid(null)
        setBestAsk(null)
        return
      }

      setOrderbookLoading(true)

      const res = await fetch(`/api/orderbook?marketId=${marketId}&outcomeId=${outcomeId}`)
      const contentType = res.headers.get("content-type") || ""

      if (!contentType.includes("application/json")) {
        const text = await res.text()
        console.error("Non-JSON response from /api/orderbook:", text.slice(0, 500))
        throw new Error(`/api/orderbook returned non-JSON response. Status: ${res.status}`)
      }

      const data: OrderbookResponse = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Could not load orderbook.")
      }

      setBids(data.bids ?? [])
      setAsks(data.asks ?? [])
      setBestBid(data.bestBid ?? null)
      setBestAsk(data.bestAsk ?? null)
    } catch (error) {
      setBids([])
      setAsks([])
      setBestBid(null)
      setBestAsk(null)
      setError(error instanceof Error ? error.message : "Could not load orderbook.")
    } finally {
      setOrderbookLoading(false)
    }
  }

  useEffect(() => {
    if (marketId) {
      fetchMarket()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketId])

  useEffect(() => {
    if (selectedOutcome?.id) {
      fetchOrderbook(selectedOutcome.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOutcome?.id])

  function selectOutcome(code: "YES" | "NO") {
    setSelectedCode(code)

    if (!market) return

    const price = code === "YES" ? market.yesPrice : market.noPrice
    setPriceCents(String(price ?? 50))
  }

  async function placeOrder() {
    try {
      setError("")
      setSuccess("")
      setPlacing(true)

      if (!market) {
        throw new Error("Market not loaded.")
      }

      if (!selectedOutcome?.id) {
        throw new Error("Selected outcome not found.")
      }

      if (market.status !== "open") {
        throw new Error("Market is not open for trading.")
      }

      const accessToken = await getAccessToken()

      if (!accessToken) {
        throw new Error("Please login first.")
      }

      const price = Number(priceCents)
      const qty = Number(quantity)

      if (!Number.isInteger(price) || price < 1 || price > 99) {
        throw new Error("Price must be an integer between 1 and 99 cents.")
      }

      if (!Number.isInteger(qty) || qty <= 0) {
        throw new Error("Quantity must be a positive integer.")
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          marketId: market.id,
          outcomeId: selectedOutcome.id,
          side,
          priceCents: price,
          quantity: qty,
          clientOrderId: crypto.randomUUID(),
        }),
      })

      const contentType = res.headers.get("content-type") || ""

      if (!contentType.includes("application/json")) {
        const text = await res.text()
        console.error("Non-JSON response from /api/orders:", text.slice(0, 500))
        throw new Error(`/api/orders returned non-JSON response. Status: ${res.status}`)
      }

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Order failed.")
      }

      setSuccess(`${side === "buy" ? "Buy" : "Sell"} ${selectedCode} order placed successfully.`)

      await fetchMarket({ silent: true })
      await fetchOrderbook(selectedOutcome.id)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Order failed.")
    } finally {
      setPlacing(false)
    }
  }

  async function mintCompleteSets() {
    try {
      setError("")
      setSuccess("")
      setMinting(true)

      if (!market) {
        throw new Error("Market not loaded.")
      }

      if (market.status !== "open") {
        throw new Error("Market is not open for minting.")
      }

      if (!market.outcomes || market.outcomes.length < 2) {
        throw new Error("Market must have at least two outcomes.")
      }

      const accessToken = await getAccessToken()

      if (!accessToken) {
        throw new Error("Please login first.")
      }

      const qty = Number(mintQuantity)

      if (!Number.isInteger(qty) || qty <= 0) {
        throw new Error("Mint quantity must be a positive integer.")
      }

      const res = await fetch("/api/complete-sets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          marketId: market.id,
          quantity: qty,
        }),
      })

      const contentType = res.headers.get("content-type") || ""

      if (!contentType.includes("application/json")) {
        const text = await res.text()
        console.error("Non-JSON response from /api/complete-sets:", text.slice(0, 500))
        throw new Error(`/api/complete-sets returned non-JSON response. Status: ${res.status}`)
      }

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to mint complete sets.")
      }

      setSuccess(`Minted ${qty} complete YES/NO sets successfully.`)

      await fetchMarket({ silent: true })

      if (selectedOutcome?.id) {
        await fetchOrderbook(selectedOutcome.id)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to mint complete sets.")
    } finally {
      setMinting(false)
    }
  }

  if (loading) {
    return (
      <main className="p-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">
            Loading market...
          </p>
        </section>
      </main>
    )
  }

  if (!market) {
    return (
      <main className="p-6">
        <section className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
          <h1 className="text-xl font-black">Market not found</h1>
          <p className="mt-2 text-sm font-semibold">{error}</p>

          <Link
            href="/markets"
            className="mt-5 inline-flex rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white"
          >
            Back to markets
          </Link>
        </section>
      </main>
    )
  }

  const isTradingDisabled = market.status !== "open"

  return (
    <main className="p-6">
      <section className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1fr_390px]">
        <div className="space-y-6">
          {/* Market header */}
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <Link
                href="/markets"
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700 transition hover:bg-orange-50 hover:text-orange-700"
              >
                ← Back to Markets
              </Link>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                {market.category || "Market"}
              </span>

              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-200">
                {market.status}
              </span>
            </div>

            <h1 className="max-w-4xl text-3xl font-black leading-tight tracking-[-0.06em] text-slate-950 md:text-5xl">
              {market.title}
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
              {market.description || "No description provided yet."}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-4">
              <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                  YES price
                </p>
                <p className="mt-1 text-3xl font-black text-emerald-700">
                  {market.yesPrice}¢
                </p>
              </div>

              <div className="rounded-2xl bg-red-50 p-4 ring-1 ring-red-100">
                <p className="text-xs font-black uppercase tracking-wide text-red-700">
                  NO price
                </p>
                <p className="mt-1 text-3xl font-black text-red-700">
                  {market.noPrice}¢
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Volume
                </p>
                <p className="mt-2 text-xl font-black text-slate-950">
                  {formatMoneyFromCents(market.volumeCents)}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Closes
                </p>
                <p className="mt-2 text-sm font-black text-slate-950">
                  {formatDate(market.closes_at)}
                </p>
              </div>
            </div>
          </section>

          {/* Orderbook */}
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
                  Orderbook
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Showing bids and asks for {selectedCode}.
                </p>
              </div>

              <button
                type="button"
                onClick={() => fetchOrderbook(selectedOutcome?.id)}
                disabled={orderbookLoading || !selectedOutcome?.id}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                {orderbookLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Best bid
                </p>
                <p className="mt-2 text-3xl font-black text-emerald-700">
                  {bestBid ? `${bestBid.priceCents}¢` : "—"}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {bestBid ? `${bestBid.quantity} shares` : "No buy orders"}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Best ask
                </p>
                <p className="mt-2 text-3xl font-black text-red-700">
                  {bestAsk ? `${bestAsk.priceCents}¢` : "—"}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {bestAsk ? `${bestAsk.quantity} shares` : "No sell orders"}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div className="overflow-hidden rounded-3xl border border-slate-200">
                <div className="bg-emerald-50 px-4 py-3">
                  <h3 className="text-sm font-black text-emerald-800">
                    Bids — Buyers
                  </h3>
                </div>

                {bids.length === 0 ? (
                  <div className="p-5 text-sm font-semibold text-slate-500">
                    No bids yet.
                  </div>
                ) : (
                  <table className="w-full text-left text-sm">
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {bids.slice(0, 10).map((level) => (
                        <tr key={`bid-${level.priceCents}`}>
                          <td className="px-4 py-3 font-black text-emerald-700">
                            {level.priceCents}¢
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-700">
                            {level.quantity}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-700">
                            {formatMoneyFromCents(level.valueCents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="overflow-hidden rounded-3xl border border-slate-200">
                <div className="bg-red-50 px-4 py-3">
                  <h3 className="text-sm font-black text-red-800">
                    Asks — Sellers
                  </h3>
                </div>

                {asks.length === 0 ? (
                  <div className="p-5 text-sm font-semibold text-slate-500">
                    No asks yet.
                  </div>
                ) : (
                  <table className="w-full text-left text-sm">
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {asks.slice(0, 10).map((level) => (
                        <tr key={`ask-${level.priceCents}`}>
                          <td className="px-4 py-3 font-black text-red-700">
                            {level.priceCents}¢
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-700">
                            {level.quantity}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-700">
                            {formatMoneyFromCents(level.valueCents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </section>

          {/* Recent trades */}
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
              Recent trades
            </h2>

            <div className="mt-5 divide-y divide-slate-100">
              {market.trades.length === 0 ? (
                <p className="text-sm font-semibold text-slate-500">
                  No trades yet.
                </p>
              ) : (
                market.trades.map((trade) => {
                  const outcome = market.outcomes.find(
                    (item) => item.id === trade.outcome_id
                  )

                  return (
                    <div
                      key={trade.id}
                      className="flex items-center justify-between gap-4 py-3 text-sm"
                    >
                      <div>
                        <p className="font-black text-slate-950">
                          {trade.quantity} shares
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-400">
                          {outcome?.code ?? "Outcome"} ·{" "}
                          {formatDateTime(trade.created_at)}
                        </p>
                      </div>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                        {trade.price_cents}¢
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </section>
        </div>

        {/* Trade card */}
        <aside className="space-y-6">
          <div className="sticky top-24 space-y-6">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
                Trade
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Place a secured order through the Qwikeer engine.
              </p>

              {error && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {error}
                </div>
              )}

              {success && (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  {success}
                </div>
              )}

              {isTradingDisabled && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
                  This market is not open for trading.
                </div>
              )}

              <div className="mt-5 grid grid-cols-2 gap-2">
                {(["YES", "NO"] as const).map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => selectOutcome(code)}
                    className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                      selectedCode === code
                        ? code === "YES"
                          ? "bg-emerald-600 text-white"
                          : "bg-red-600 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {code}
                  </button>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
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

              <label className="mt-5 block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Limit price, cents
                </span>

                <input
                  value={priceCents}
                  onChange={(event) => setPriceCents(event.target.value)}
                  inputMode="numeric"
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />
              </label>

              <label className="mt-4 block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Quantity
                </span>

                <input
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  inputMode="numeric"
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />
              </label>

              <div className="mt-5 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Selected outcome</span>
                  <span className="font-black">{selectedCode}</span>
                </div>

                <div className="mt-3 flex justify-between text-sm">
                  <span className="text-slate-500">Order side</span>
                  <span className="font-black capitalize">{side}</span>
                </div>

                <div className="mt-3 flex justify-between text-sm">
                  <span className="text-slate-500">Limit price</span>
                  <span className="font-black">{Number(priceCents || 0)}¢</span>
                </div>

                <div className="mt-3 flex justify-between text-sm">
                  <span className="text-slate-500">Estimated value</span>
                  <span className="font-black">
                    {formatMoneyFromCents(totalOrderValueCents)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={placing || isTradingDisabled}
                onClick={placeOrder}
                className="mt-5 w-full rounded-2xl bg-[#FF7A1A] px-5 py-4 text-sm font-black text-white shadow-sm transition hover:bg-[#E85F00] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {placing
                  ? "Placing order..."
                  : `Confirm ${side.toUpperCase()} ${selectedCode}`}
              </button>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-black tracking-[-0.04em] text-slate-950">
                Mint complete sets
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Minting creates equal YES and NO shares. You can use those
                shares to place sell orders.
              </p>

              <label className="mt-4 block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Quantity
                </span>

                <input
                  value={mintQuantity}
                  onChange={(event) => setMintQuantity(event.target.value)}
                  inputMode="numeric"
                  className="mt-2 h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />
              </label>

              <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm ring-1 ring-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500">Cost</span>
                  <span className="font-black">
                    {formatMoneyFromCents(mintCostCents)}
                  </span>
                </div>

                <div className="mt-2 flex justify-between">
                  <span className="text-slate-500">You receive</span>
                  <span className="font-black">
                    {Number(mintQuantity || 0)} YES +{" "}
                    {Number(mintQuantity || 0)} NO
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={mintCompleteSets}
                disabled={minting || isTradingDisabled}
                className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {minting ? "Minting..." : "Mint complete sets"}
              </button>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-black tracking-[-0.04em] text-slate-950">
                Account links
              </h3>

              <div className="mt-4 grid gap-2">
                <Link
                  href="/portfolio"
                  className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200"
                >
                  View portfolio
                </Link>

                <Link
                  href="/orders"
                  className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200"
                >
                  View orders
                </Link>
              </div>
            </section>
          </div>
        </aside>
      </section>
    </main>
  )
}