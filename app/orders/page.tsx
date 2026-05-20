"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

/**
 * Qwikeer Orders Page
 *
 * Shows:
 * - all user orders
 * - open / partial / filled / cancelled
 * - cancel action for open/partial orders
 */

type MarketDisplay = {
  id: string
  title: string
  category?: string | null
  status?: string | null
  closes_at?: string | null
}

type OutcomeDisplay = {
  id: string
  market_id?: string
  code: string
  name: string
  sort_order?: number
}

type Order = {
  id: string
  user_id: string
  market_id: string
  outcome_id: string
  side: "buy" | "sell"
  price_cents: number
  quantity: number
  filled_quantity: number
  remaining_quantity: number
  status: "open" | "partial" | "filled" | "cancelled" | "rejected"
  created_at: string
  updated_at?: string
  market?: MarketDisplay | null
  outcome?: OutcomeDisplay | null
}

type OrdersResponse = {
  orders: Order[]
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

function statusStyles(status: string) {
  if (status === "open") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200"
  }

  if (status === "partial") {
    return "bg-amber-50 text-amber-700 ring-amber-200"
  }

  if (status === "filled") {
    return "bg-blue-50 text-blue-700 ring-blue-200"
  }

  if (status === "cancelled") {
    return "bg-slate-100 text-slate-600 ring-slate-200"
  }

  return "bg-red-50 text-red-700 ring-red-200"
}

export default function OrdersPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [cancelingOrderId, setCancelingOrderId] = useState<string | null>(null)

  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [statusFilter, setStatusFilter] = useState<
    "all" | "open" | "partial" | "filled" | "cancelled"
  >("all")

  const [sideFilter, setSideFilter] = useState<"all" | "buy" | "sell">("all")

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesStatus =
        statusFilter === "all" ? true : order.status === statusFilter

      const matchesSide = sideFilter === "all" ? true : order.side === sideFilter

      return matchesStatus && matchesSide
    })
  }, [orders, statusFilter, sideFilter])

  const openOrdersCount = useMemo(() => {
    return orders.filter(
      (order) => order.status === "open" || order.status === "partial"
    ).length
  }, [orders])

  const totalRemainingValueCents = useMemo(() => {
    return orders
      .filter((order) => order.status === "open" || order.status === "partial")
      .reduce((sum, order) => {
        return (
          sum +
          Number(order.remaining_quantity || 0) * Number(order.price_cents || 0)
        )
      }, 0)
  }, [orders])

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    return session?.access_token ?? null
  }

  async function fetchOrders(options?: { silent?: boolean }) {
    try {
      if (options?.silent) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError("")

      const accessToken = await getAccessToken()

      if (!accessToken) {
        setOrders([])
        throw new Error("Please login first.")
      }

      const res = await fetch("/api/orders", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      const contentType = res.headers.get("content-type") || ""

      if (!contentType.includes("application/json")) {
        const text = await res.text()
        console.error("Non-JSON response from /api/orders:", text.slice(0, 500))
        throw new Error(`/api/orders returned non-JSON response. Status: ${res.status}`)
      }

      const data: OrdersResponse = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Could not load orders.")
      }

      setOrders(data.orders ?? [])
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load orders.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

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
      await fetchOrders({ silent: true })
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not cancel order.")
    } finally {
      setCancelingOrderId(null)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  if (loading) {
    return (
      <main className="p-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">
            Loading orders...
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
                Qwikeer Orders
              </p>

              <h1 className="mt-2 text-4xl font-black tracking-[-0.06em] text-slate-950 md:text-6xl">
                Your order history.
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                View your open, partial, filled, and cancelled Qwikeer orders.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fetchOrders({ silent: true })}
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

        {/* Summary */}
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Total orders
            </p>
            <p className="mt-3 text-4xl font-black tracking-[-0.06em] text-slate-950">
              {orders.length}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Open / partial
            </p>
            <p className="mt-3 text-4xl font-black tracking-[-0.06em] text-slate-950">
              {openOrdersCount}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Open value
            </p>
            <p className="mt-3 text-4xl font-black tracking-[-0.06em] text-slate-950">
              {formatMoneyFromCents(totalRemainingValueCents)}
            </p>
          </div>
        </section>

        {/* Filters */}
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Status filter
              </span>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as typeof statusFilter)
                }
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
              >
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="partial">Partial</option>
                <option value="filled">Filled</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Side filter
              </span>

              <select
                value={sideFilter}
                onChange={(event) =>
                  setSideFilter(event.target.value as typeof sideFilter)
                }
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
              >
                <option value="all">All sides</option>
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
            </label>
          </div>
        </section>

        {/* Orders table */}
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
            Orders
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Showing {filteredOrders.length} of {orders.length} orders.
          </p>

          {filteredOrders.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <p className="text-sm font-black text-slate-700">
                No orders found.
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Place your first order from a market detail page.
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
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-4">Market</th>
                      <th className="px-5 py-4">Side</th>
                      <th className="px-5 py-4">Outcome</th>
                      <th className="px-5 py-4">Price</th>
                      <th className="px-5 py-4">Quantity</th>
                      <th className="px-5 py-4">Filled</th>
                      <th className="px-5 py-4">Remaining</th>
                      <th className="px-5 py-4">Value</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4">Created</th>
                      <th className="px-5 py-4 text-right">Action</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.map((order) => {
                      const remainingValue =
                        Number(order.remaining_quantity || 0) *
                        Number(order.price_cents || 0)

                      const canCancel =
                        order.status === "open" || order.status === "partial"

                      return (
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

                          <td className="px-5 py-4">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${
                                order.outcome?.code === "YES"
                                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                  : "bg-red-50 text-red-700 ring-red-200"
                              }`}
                            >
                              {order.outcome?.code ?? "N/A"}
                            </span>
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

                          <td className="px-5 py-4 font-black text-slate-950">
                            {formatMoneyFromCents(remainingValue)}
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${statusStyles(
                                order.status
                              )}`}
                            >
                              {order.status}
                            </span>
                          </td>

                          <td className="px-5 py-4 font-semibold text-slate-500">
                            {formatDateTime(order.created_at)}
                          </td>

                          <td className="px-5 py-4 text-right">
                            {canCancel ? (
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
                            ) : (
                              <span className="text-xs font-bold text-slate-400">
                                —
                              </span>
                            )}
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
      </div>
    </main>
  )
}