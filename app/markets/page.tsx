"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

/**
 * MarketsPage
 *
 * Lists all Qwikeer markets.
 *
 * Uses:
 * - GET /api/markets
 */

type Outcome = {
  id: string
  market_id: string
  code: string
  name: string
  sort_order: number
}

type Market = {
  id: string
  title: string
  description?: string | null
  category?: string | null
  status: string
  closes_at?: string | null
  resolved_outcome_id?: string | null
  created_at?: string | null
  outcomes: Outcome[]
  yesPrice: number
  noPrice: number
  volumeCents: number
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

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const filteredMarkets = useMemo(() => {
    return markets.filter((market) => {
      const text = `${market.title} ${market.description ?? ""} ${
        market.category ?? ""
      }`.toLowerCase()

      const matchesQuery = query.trim()
        ? text.includes(query.trim().toLowerCase())
        : true

      const matchesStatus =
        statusFilter === "all" ? true : market.status === statusFilter

      return matchesQuery && matchesStatus
    })
  }, [markets, query, statusFilter])

  /**
   * Fetch markets from public API.
   */
  async function fetchMarkets(options?: { silent?: boolean }) {
    try {
      if (options?.silent) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError(null)

      const res = await fetch("/api/markets")

      const contentType = res.headers.get("content-type") || ""

      if (!contentType.includes("application/json")) {
        const text = await res.text()
        console.error("Non-JSON response from /api/markets:", text.slice(0, 500))
        throw new Error(`/api/markets returned non-JSON response. Status: ${res.status}`)
      }

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Could not load markets.")
      }

      setMarkets(Array.isArray(data) ? data : [])
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load markets.")
      setMarkets([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchMarkets()
  }, [])

  if (loading) {
    return (
      <main className="p-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">
            Loading Qwikeer markets...
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
                Qwikeer Markets
              </p>

              <h1 className="mt-2 text-4xl font-black tracking-[-0.06em] text-slate-950 md:text-6xl">
                Predict what happens next.
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Browse live YES/NO prediction markets and trade your view using
                the Qwikeer engine.
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
                Admin
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

        {/* Filters */}
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1fr_240px]">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Search markets
              </span>

              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by title, category, description..."
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
              />
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Status
              </span>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
              >
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="draft">Draft</option>
                <option value="paused">Paused</option>
                <option value="closed">Closed</option>
                <option value="resolved">Resolved</option>
              </select>
            </label>
          </div>
        </section>

        {/* Markets grid */}
        {filteredMarkets.length === 0 ? (
          <section className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm">
            <p className="text-lg font-black text-slate-950">
              No markets found.
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Create your first market from the admin page.
            </p>

            <Link
              href="/admin"
              className="mt-5 inline-flex rounded-2xl bg-[#FF7A1A] px-5 py-3 text-sm font-black text-white transition hover:bg-[#E85F00]"
            >
              Go to Admin
            </Link>
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredMarkets.map((market) => {
              const yesOutcomeExists = market.outcomes?.some(
                (outcome) => String(outcome.code).toUpperCase() === "YES"
              )

              const noOutcomeExists = market.outcomes?.some(
                (outcome) => String(outcome.code).toUpperCase() === "NO"
              )

              return (
                <Link
                  key={market.id}
                  href={`/markets/${market.id}`}
                  className="group rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${statusClass(
                        market.status
                      )}`}
                    >
                      {market.status}
                    </span>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                      {market.category || "General"}
                    </span>
                  </div>

                  <h2 className="mt-4 line-clamp-2 text-xl font-black tracking-[-0.04em] text-slate-950 group-hover:text-orange-600">
                    {market.title}
                  </h2>

                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-500">
                    {market.description || "No description provided yet."}
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
                      <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                        YES
                      </p>
                      <p className="mt-1 text-2xl font-black text-emerald-700">
                        {Number(market.yesPrice || 50)}¢
                      </p>
                    </div>

                    <div className="rounded-2xl bg-red-50 p-4 ring-1 ring-red-100">
                      <p className="text-xs font-black uppercase tracking-wide text-red-700">
                        NO
                      </p>
                      <p className="mt-1 text-2xl font-black text-red-700">
                        {Number(market.noPrice || 50)}¢
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 text-xs font-bold text-slate-500">
                    <div>
                      <p className="uppercase tracking-wide">Volume</p>
                      <p className="mt-1 text-sm font-black text-slate-950">
                        {formatMoneyFromCents(market.volumeCents || 0)}
                      </p>
                    </div>

                    <div>
                      <p className="uppercase tracking-wide">Closes</p>
                      <p className="mt-1 text-sm font-black text-slate-950">
                        {formatDate(market.closes_at)}
                      </p>
                    </div>
                  </div>

                  {(!yesOutcomeExists || !noOutcomeExists) && (
                    <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700">
                      This market is missing YES/NO outcomes.
                    </div>
                  )}
                </Link>
              )
            })}
          </section>
        )}
      </div>
    </main>
  )
}