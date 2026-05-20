"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

/**
 * Qwikeer Portfolio Page
 *
 * Shows:
 * - wallet available balance
 * - wallet locked balance
 * - positions
 * - open orders
 * - cancel order action
 */

type Wallet = {
  user_id: string
  available_cents: number
  locked_cents: number
  updated_at?: string
}

type MarketDisplay = {
  id: string
  title: string
  category?: string | null
  status?: string | null
  closes_at?: string | null
  resolved_outcome_id?: string | null
}

type OutcomeDisplay = {
  id: string
  market_id?: string
  code: string
  name: string
  sort_order?: number
}

type Position = {
  id: string
  market_id: string
  outcome_id: string
  available_quantity: number
  locked_quantity: number
  avg_price_cents: number
  updated_at?: string
  market?: MarketDisplay | null
  outcome?: OutcomeDisplay | null
}

type OpenOrder = {
  id: string
  market_id: string
  outcome_id: string
  side: "buy" | "sell"
  price_cents: number
  quantity: number
  filled_quantity: number
  remaining_quantity: number
  status: string
  created_at: string
  updated_at?: string
  market?: MarketDisplay | null
  outcome?: OutcomeDisplay | null
}

type PortfolioResponse = {
  wallet: Wallet | null
  positions: Position[]
  openOrders: OpenOrder[]
  error?: string
}

function formatMoneyFromCents(value: number) {
  return `${(Number(value || 0) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not available"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return "Not available"

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function PortfolioPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [cancelingOrderId, setCancelingOrderId] = useState<string | null>(null)

  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([])

  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  /**
   * Position cost basis estimate.
   */
  const totalPositionCostCents = useMemo(() => {
    return positions.reduce((sum, position) => {
      return (
        sum +
        Number(position.available_quantity || 0) *
          Number(position.avg_price_cents || 0)
      )
    }, 0)
  }, [positions])

  /**
   * Remaining value of open orders.
   */
  const totalOpenOrderValueCents = useMemo(() => {
    return openOrders.reduce((sum, order) => {
      return (
        sum +
        Number(order.remaining_quantity || 0) *
          Number(order.price_cents || 0)
      )
    }, 0)
  }, [openOrders])

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    return session?.access_token ?? null
  }

  /**
   * Fetch portfolio from secure API.
   */
  async function fetchPortfolio(options?: { silent?: boolean }) {
    try {
      if (options?.silent) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError("")

      const accessToken = await getAccessToken()

      if (!accessToken) {
        setWallet(null)
        setPositions([])
        setOpenOrders([])
        throw new Error("Please login first.")
      }

      const res = await fetch("/api/portfolio", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      const contentType = res.headers.get("content-type") || ""

      if (!contentType.includes("application/json")) {
        const text = await res.text()
        console.error("Non-JSON response from /api/portfolio:", text.slice(0, 500))
        throw new Error(`/api/portfolio returned non-JSON response. Status: ${res.status}`)
      }

      const data: PortfolioResponse = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Could not load portfolio.")
      }

      setWallet(data.wallet)
      setPositions(data.positions ?? [])
      setOpenOrders(data.openOrders ?? [])
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load portfolio.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  /**
   * Cancel an open order.
   */
  async function cancelOrder(orderId: string) {
    try {
      setCancelingOrderId(orderId)
      setError("")
      setSuccess("")

      const accessToken = await getAccessToken()

      if (!accessToken) {
        throw new Error("Please login first.")
      }

      const res = await fetch("/api/orders/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          orderId,
        }),
      })

      const contentType = res.headers.get("content-type") || ""

      if (!contentType.includes("application/json")) {
        const text = await res.text()
        console.error("Non-JSON response from /api/orders/cancel:", text.slice(0, 500))
        throw new Error(`/api/orders/cancel returned non-JSON response. Status: ${res.status}`)
      }

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Could not cancel order.")
      }

      setSuccess("Order cancelled successfully.")
      await fetchPortfolio({ silent: true })
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not cancel order.")
    } finally {
      setCancelingOrderId(null)
    }
  }

  useEffect(() => {
    fetchPortfolio()
  }, [])

  if (loading) {
    return (
      <main className="p-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">
            Loading portfolio...
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
                Qwikeer Portfolio
              </p>

              <h1 className="mt-2 text-4xl font-black tracking-[-0.06em] text-slate-950 md:text-6xl">
                Your trading account.
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Track your balance, positions, and open orders from the Qwikeer
                prediction market engine.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fetchPortfolio({ silent: true })}
                disabled={refreshing}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>

              <Link
                href="/markets"
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
              >
                Browse markets
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

        {/* Wallet summary */}
        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Available balance
            </p>
            <p className="mt-3 text-3xl font-black tracking-[-0.05em] text-slate-950">
              {formatMoneyFromCents(wallet?.available_cents ?? 0)}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Locked balance
            </p>
            <p className="mt-3 text-3xl font-black tracking-[-0.05em] text-slate-950">
              {formatMoneyFromCents(wallet?.locked_cents ?? 0)}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Position cost
            </p>
            <p className="mt-3 text-3xl font-black tracking-[-0.05em] text-slate-950">
              {formatMoneyFromCents(totalPositionCostCents)}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Open order value
            </p>
            <p className="mt-3 text-3xl font-black tracking-[-0.05em] text-slate-950">
              {formatMoneyFromCents(totalOpenOrderValueCents)}
            </p>
          </div>
        </section>

        {/* Positions */}
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
            Positions
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Shares you currently own or have locked.
          </p>

          {positions.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <p className="text-sm font-black text-slate-700">
                No positions yet.
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Mint complete sets or place matched buy orders to create
                positions.
              </p>

              <Link
                href="/markets"
                className="mt-5 inline-flex rounded-2xl bg-[#FF7A1A] px-5 py-3 text-sm font-black text-white"
              >
                Browse markets
              </Link>
            </div>
          ) : (
            <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-4">Market</th>
                      <th className="px-5 py-4">Outcome</th>
                      <th className="px-5 py-4">Available</th>
                      <th className="px-5 py-4">Locked</th>
                      <th className="px-5 py-4">Avg price</th>
                      <th className="px-5 py-4">Cost basis</th>
                      <th className="px-5 py-4">Status</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {positions.map((position) => {
                      const costBasis =
                        Number(position.available_quantity || 0) *
                        Number(position.avg_price_cents || 0)

                      return (
                        <tr key={position.id} className="bg-white">
                          <td className="px-5 py-4">
                            <Link
                              href={`/markets/${position.market_id}`}
                              className="font-black text-slate-950 hover:text-orange-600"
                            >
                              {position.market?.title ?? "Unknown market"}
                            </Link>

                            <p className="mt-1 text-xs font-semibold text-slate-400">
                              {position.market?.category ?? "Market"}
                            </p>
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${
                                position.outcome?.code === "YES"
                                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                  : "bg-red-50 text-red-700 ring-red-200"
                              }`}
                            >
                              {position.outcome?.code ?? "N/A"}
                            </span>
                          </td>

                          <td className="px-5 py-4 font-bold text-slate-700">
                            {Number(position.available_quantity || 0)}
                          </td>

                          <td className="px-5 py-4 font-bold text-slate-700">
                            {Number(position.locked_quantity || 0)}
                          </td>

                          <td className="px-5 py-4 font-black text-slate-950">
                            {Number(position.avg_price_cents || 0)}¢
                          </td>

                          <td className="px-5 py-4 font-black text-slate-950">
                            {formatMoneyFromCents(costBasis)}
                          </td>

                          <td className="px-5 py-4">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                              {position.market?.status ?? "unknown"}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Open orders */}
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
            Open orders
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Orders waiting to be matched or partially filled.
          </p>

          {openOrders.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <p className="text-sm font-black text-slate-700">
                No open orders.
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Open limit orders will appear here.
              </p>
            </div>
          ) : (
            <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-4">Market</th>
                      <th className="px-5 py-4">Side</th>
                      <th className="px-5 py-4">Outcome</th>
                      <th className="px-5 py-4">Price</th>
                      <th className="px-5 py-4">Quantity</th>
                      <th className="px-5 py-4">Filled</th>
                      <th className="px-5 py-4">Remaining</th>
                      <th className="px-5 py-4">Created</th>
                      <th className="px-5 py-4 text-right">Action</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {openOrders.map((order) => (
                      <tr key={order.id} className="bg-white">
                        <td className="px-5 py-4">
                          <Link
                            href={`/markets/${order.market_id}`}
                            className="font-black text-slate-950 hover:text-orange-600"
                          >
                            {order.market?.title ?? "Unknown market"}
                          </Link>

                          <p className="mt-1 text-xs font-semibold text-slate-400">
                            {order.market?.category ?? "Market"}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black uppercase ring-1 ${
                              order.side === "buy"
                                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                : "bg-red-50 text-red-700 ring-red-200"
                            }`}
                          >
                            {order.side}
                          </span>
                        </td>

                        <td className="px-5 py-4 font-black text-slate-950">
                          {order.outcome?.code ?? "N/A"}
                        </td>

                        <td className="px-5 py-4 font-black text-slate-950">
                          {Number(order.price_cents || 0)}¢
                        </td>

                        <td className="px-5 py-4 font-bold text-slate-700">
                          {Number(order.quantity || 0)}
                        </td>

                        <td className="px-5 py-4 font-bold text-slate-700">
                          {Number(order.filled_quantity || 0)}
                        </td>

                        <td className="px-5 py-4 font-bold text-slate-700">
                          {Number(order.remaining_quantity || 0)}
                        </td>

                        <td className="px-5 py-4 font-semibold text-slate-500">
                          {formatDateTime(order.created_at)}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            disabled={cancelingOrderId === order.id}
                            onClick={() => cancelOrder(order.id)}
                            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {cancelingOrderId === order.id
                              ? "Canceling..."
                              : "Cancel"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}