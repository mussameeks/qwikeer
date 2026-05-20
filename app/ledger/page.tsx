"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

/**
 * Qwikeer Ledger Page
 *
 * Shows user wallet/audit history.
 *
 * This is important for debugging and trust:
 * - users can see every balance movement
 * - admins can verify settlement behavior
 * - developers can debug engine actions
 */

type LedgerEntry = {
  id: string
  user_id: string
  type:
    | "deposit"
    | "withdrawal"
    | "order_lock"
    | "order_unlock"
    | "trade_debit"
    | "trade_credit"
    | "trade_refund"
    | "payout"
    | "market_refund"
    | "complete_set_mint"
    | "admin_adjustment"
  amount_cents: number
  balance_available_after?: number | null
  balance_locked_after?: number | null
  reference_id?: string | null
  note?: string | null
  created_at: string
}

type LedgerResponse = {
  entries: LedgerEntry[]
  error?: string
}

function formatMoneyFromCents(value: number) {
  const sign = value < 0 ? "-" : ""

  return `${sign}${(Math.abs(Number(value || 0)) / 100).toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`
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

function ledgerTypeLabel(type: string) {
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function ledgerTypeClass(type: string) {
  if (type === "deposit" || type === "payout" || type === "trade_credit") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200"
  }

  if (
    type === "order_unlock" ||
    type === "trade_refund" ||
    type === "market_refund"
  ) {
    return "bg-blue-50 text-blue-700 ring-blue-200"
  }

  if (type === "order_lock" || type === "complete_set_mint") {
    return "bg-amber-50 text-amber-700 ring-amber-200"
  }

  if (type === "trade_debit" || type === "withdrawal") {
    return "bg-red-50 text-red-700 ring-red-200"
  }

  return "bg-slate-100 text-slate-700 ring-slate-200"
}

export default function LedgerPage() {
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")

  const [typeFilter, setTypeFilter] = useState("all")

  const filteredEntries = useMemo(() => {
    if (typeFilter === "all") return entries

    return entries.filter((entry) => entry.type === typeFilter)
  }, [entries, typeFilter])

  const availableTypes = useMemo(() => {
    return Array.from(new Set(entries.map((entry) => entry.type))).sort()
  }, [entries])

  const totalPositiveCents = useMemo(() => {
    return filteredEntries.reduce((sum, entry) => {
      return entry.amount_cents > 0 ? sum + entry.amount_cents : sum
    }, 0)
  }, [filteredEntries])

  const totalNegativeCents = useMemo(() => {
    return filteredEntries.reduce((sum, entry) => {
      return entry.amount_cents < 0 ? sum + Math.abs(entry.amount_cents) : sum
    }, 0)
  }, [filteredEntries])

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    return session?.access_token ?? null
  }

  async function fetchLedger(options?: { silent?: boolean }) {
    try {
      if (options?.silent) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError("")

      const accessToken = await getAccessToken()

      if (!accessToken) {
        setEntries([])
        throw new Error("Please login first.")
      }

      const res = await fetch("/api/ledger", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      const contentType = res.headers.get("content-type") || ""

      if (!contentType.includes("application/json")) {
        const text = await res.text()
        console.error("Non-JSON response from /api/ledger:", text.slice(0, 500))
        throw new Error(`/api/ledger returned non-JSON response. Status: ${res.status}`)
      }

      const data: LedgerResponse = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Could not load ledger.")
      }

      setEntries(data.entries ?? [])
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load ledger.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchLedger()
  }, [])

  if (loading) {
    return (
      <main className="p-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">
            Loading ledger...
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
                Qwikeer Ledger
              </p>

              <h1 className="mt-2 text-4xl font-black tracking-[-0.06em] text-slate-950 md:text-6xl">
                Wallet audit trail.
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Review every balance movement from deposits, orders, minting,
                trades, refunds, and market payouts.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fetchLedger({ silent: true })}
                disabled={refreshing}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>

              <Link
                href="/portfolio"
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
              >
                Portfolio
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

        {/* Summary */}
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Entries
            </p>

            <p className="mt-3 text-4xl font-black tracking-[-0.06em] text-slate-950">
              {filteredEntries.length}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Positive movement
            </p>

            <p className="mt-3 text-4xl font-black tracking-[-0.06em] text-emerald-700">
              {formatMoneyFromCents(totalPositiveCents)}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Negative movement
            </p>

            <p className="mt-3 text-4xl font-black tracking-[-0.06em] text-red-700">
              {formatMoneyFromCents(-totalNegativeCents)}
            </p>
          </div>
        </section>

        {/* Filters */}
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">
              Type filter
            </span>

            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
            >
              <option value="all">All types</option>

              {availableTypes.map((type) => (
                <option key={type} value={type}>
                  {ledgerTypeLabel(type)}
                </option>
              ))}
            </select>
          </label>
        </section>

        {/* Ledger table */}
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
            Ledger entries
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Showing {filteredEntries.length} of {entries.length} entries.
          </p>

          {filteredEntries.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <p className="text-sm font-black text-slate-700">
                No ledger entries yet.
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Credit balance, place orders, mint sets, or resolve markets to
                create ledger entries.
              </p>
            </div>
          ) : (
            <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-4">Type</th>
                      <th className="px-5 py-4">Amount</th>
                      <th className="px-5 py-4">Available after</th>
                      <th className="px-5 py-4">Locked after</th>
                      <th className="px-5 py-4">Note</th>
                      <th className="px-5 py-4">Reference</th>
                      <th className="px-5 py-4">Created</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredEntries.map((entry) => (
                      <tr key={entry.id} className="bg-white">
                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${ledgerTypeClass(
                              entry.type
                            )}`}
                          >
                            {ledgerTypeLabel(entry.type)}
                          </span>
                        </td>

                        <td
                          className={`px-5 py-4 font-black ${
                            entry.amount_cents >= 0
                              ? "text-emerald-700"
                              : "text-red-700"
                          }`}
                        >
                          {formatMoneyFromCents(entry.amount_cents)}
                        </td>

                        <td className="px-5 py-4 font-bold text-slate-700">
                          {entry.balance_available_after === null ||
                          entry.balance_available_after === undefined
                            ? "—"
                            : formatMoneyFromCents(
                                entry.balance_available_after
                              )}
                        </td>

                        <td className="px-5 py-4 font-bold text-slate-700">
                          {entry.balance_locked_after === null ||
                          entry.balance_locked_after === undefined
                            ? "—"
                            : formatMoneyFromCents(entry.balance_locked_after)}
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          {entry.note || "—"}
                        </td>

                        <td className="px-5 py-4">
                          <span className="break-all text-xs font-semibold text-slate-400">
                            {entry.reference_id || "—"}
                          </span>
                        </td>

                        <td className="px-5 py-4 font-semibold text-slate-500">
                          {formatDateTime(entry.created_at)}
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