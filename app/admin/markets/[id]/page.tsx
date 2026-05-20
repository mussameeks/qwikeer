"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

/**
 * Qwikeer Admin Market Edit Page
 *
 * Admin can:
 * - edit market details
 * - change market status
 * - delete draft market
 *
 * Safety:
 * - resolved/cancelled markets cannot be edited
 * - only draft markets can be deleted
 * - markets with orders/trades cannot be deleted
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
  updated_at?: string | null
  outcomes: Outcome[]
  ordersCount: number
  tradesCount: number
}

type MarketResponse = {
  market: AdminMarket
  error?: string
}

function toDatetimeLocal(value?: string | null) {
  if (!value) return ""

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ""

  const pad = (number: number) => String(number).padStart(2, "0")

  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())

  return `${year}-${month}-${day}T${hours}:${minutes}`
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

  return "bg-slate-100 text-slate-700 ring-slate-200"
}

export default function AdminMarketEditPage() {
  const router = useRouter()
  const params = useParams()
  const marketId = String(params?.id || "")

  const [market, setMarket] = useState<AdminMarket | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("General")
  const [status, setStatus] = useState("draft")
  const [closesAt, setClosesAt] = useState("")

  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const canEdit = useMemo(() => {
    return market ? !["resolved", "cancelled"].includes(market.status) : false
  }, [market])

  const canDelete = useMemo(() => {
    if (!market) return false

    return (
      market.status === "draft" &&
      Number(market.ordersCount || 0) === 0 &&
      Number(market.tradesCount || 0) === 0
    )
  }, [market])

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    return session?.access_token ?? null
  }

  async function fetchMarket() {
    try {
      setLoading(true)
      setError("")
      setSuccess("")

      const accessToken = await getAccessToken()

      if (!accessToken) {
        throw new Error("Please login first.")
      }

      const res = await fetch(`/api/admin/markets/${marketId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      const contentType = res.headers.get("content-type") || ""

      if (!contentType.includes("application/json")) {
        const text = await res.text()
        console.error(
          "Non-JSON response from /api/admin/markets/[id]:",
          text.slice(0, 500)
        )
        throw new Error(
          `/api/admin/markets/${marketId} returned non-JSON response. Status: ${res.status}`
        )
      }

      const data: MarketResponse = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Could not load market.")
      }

      setMarket(data.market)

      setTitle(data.market.title)
      setDescription(data.market.description ?? "")
      setCategory(data.market.category ?? "General")
      setStatus(data.market.status)
      setClosesAt(toDatetimeLocal(data.market.closes_at))
    } catch (error) {
      setMarket(null)
      setError(error instanceof Error ? error.message : "Could not load market.")
    } finally {
      setLoading(false)
    }
  }

  async function saveMarket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setSaving(true)
      setError("")
      setSuccess("")

      const accessToken = await getAccessToken()

      if (!accessToken) {
        throw new Error("Please login first.")
      }

      if (!title.trim()) {
        throw new Error("Market title is required.")
      }

      if (!canEdit) {
        throw new Error("This market cannot be edited.")
      }

      const res = await fetch(`/api/admin/markets/${marketId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title,
          description,
          category,
          status,
          closesAt: closesAt || null,
        }),
      })

      const contentType = res.headers.get("content-type") || ""

      if (!contentType.includes("application/json")) {
        const text = await res.text()
        console.error(
          "Non-JSON response from PATCH /api/admin/markets/[id]:",
          text.slice(0, 500)
        )
        throw new Error(
          `PATCH /api/admin/markets/${marketId} returned non-JSON response. Status: ${res.status}`
        )
      }

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to update market.")
      }

      setSuccess("Market updated successfully.")
      await fetchMarket()
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to update market.")
    } finally {
      setSaving(false)
    }
  }

  async function deleteMarket() {
    try {
      setDeleting(true)
      setError("")
      setSuccess("")

      if (!canDelete) {
        throw new Error("This market cannot be deleted.")
      }

      const confirmed = window.confirm(
        "Delete this draft market? This action cannot be undone."
      )

      if (!confirmed) return

      const accessToken = await getAccessToken()

      if (!accessToken) {
        throw new Error("Please login first.")
      }

      const res = await fetch(`/api/admin/markets/${marketId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      const contentType = res.headers.get("content-type") || ""

      if (!contentType.includes("application/json")) {
        const text = await res.text()
        console.error(
          "Non-JSON response from DELETE /api/admin/markets/[id]:",
          text.slice(0, 500)
        )
        throw new Error(
          `DELETE /api/admin/markets/${marketId} returned non-JSON response. Status: ${res.status}`
        )
      }

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete market.")
      }

      router.push("/admin")
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to delete market.")
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    if (marketId) {
      fetchMarket()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketId])

  if (loading) {
    return (
      <main className="p-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">
            Loading market editor...
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

          <p className="mt-2 text-sm font-semibold">
            {error || "Could not load this market."}
          </p>

          <Link
            href="/admin"
            className="mt-5 inline-flex rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white"
          >
            Back to admin
          </Link>
        </section>
      </main>
    )
  }

  return (
    <main className="p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-600">
                Qwikeer Admin
              </p>

              <h1 className="mt-2 text-4xl font-black tracking-[-0.06em] text-slate-950 md:text-6xl">
                Edit market
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Update market details, pause trading, close trading, or delete
                a draft market.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={`/markets/${market.id}`}
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
              >
                Open market
              </Link>

              <Link
                href="/admin"
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
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

        {/* Summary */}
        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Status
            </p>

            <span
              className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${statusClass(
                market.status
              )}`}
            >
              {market.status}
            </span>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Orders
            </p>

            <p className="mt-3 text-3xl font-black tracking-[-0.05em] text-slate-950">
              {market.ordersCount}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Trades
            </p>

            <p className="mt-3 text-3xl font-black tracking-[-0.05em] text-slate-950">
              {market.tradesCount}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Outcomes
            </p>

            <p className="mt-3 text-3xl font-black tracking-[-0.05em] text-slate-950">
              {market.outcomes.length}
            </p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Edit form */}
          <form
            onSubmit={saveMarket}
            className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
              Market details
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Resolved markets are locked and cannot be edited here.
            </p>

            <label className="mt-5 block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Market title
              </span>

              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={!canEdit}
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              />
            </label>

            <label className="mt-4 block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Description
              </span>

              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={!canEdit}
                rows={6}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              />
            </label>

            <label className="mt-4 block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Category
              </span>

              <input
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                disabled={!canEdit}
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              />
            </label>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Status
                </span>

                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  disabled={!canEdit}
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="draft">Draft</option>
                  <option value="open">Open</option>
                  <option value="paused">Paused</option>
                  <option value="closed">Closed</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Close date
                </span>

                <input
                  type="datetime-local"
                  value={closesAt}
                  onChange={(event) => setClosesAt(event.target.value)}
                  disabled={!canEdit}
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={saving || !canEdit}
              className="mt-6 w-full rounded-2xl bg-[#FF7A1A] px-5 py-4 text-sm font-black text-white shadow-sm transition hover:bg-[#E85F00] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </form>

          {/* Side panel */}
          <aside className="space-y-6">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
                Outcomes
              </h2>

              <div className="mt-4 space-y-2">
                {market.outcomes.map((outcome) => (
                  <div
                    key={outcome.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="text-sm font-black text-slate-950">
                      {outcome.code} — {outcome.name}
                    </p>

                    <p className="mt-1 break-all text-xs font-semibold text-slate-400">
                      {outcome.id}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-red-200 bg-red-50 p-6 shadow-sm">
              <h2 className="text-xl font-black tracking-[-0.04em] text-red-800">
                Danger zone
              </h2>

              <p className="mt-2 text-sm leading-6 text-red-700">
                Only draft markets with no orders or trades can be deleted.
              </p>

              <button
                type="button"
                onClick={deleteMarket}
                disabled={deleting || !canDelete}
                className="mt-5 w-full rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete draft market"}
              </button>

              {!canDelete && (
                <p className="mt-3 text-xs font-semibold leading-5 text-red-700">
                  This market cannot be deleted because it is not draft, or it
                  already has orders/trades.
                </p>
              )}
            </section>
          </aside>
        </section>
      </div>
    </main>
  )
}