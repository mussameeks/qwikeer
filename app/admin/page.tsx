"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

/**
 * Qwikeer Admin Page
 *
 * Admin can:
 * - verify admin access
 * - create YES/NO prediction markets
 * - view markets
 * - credit demo balance for testing/dev only
 * - resolve markets and trigger payouts
 *
 * Sensitive writes go through secure API routes:
 * - GET /api/admin/me
 * - GET /api/admin/markets
 * - POST /api/admin/markets
 * - POST /api/admin/credit-balance
 * - POST /api/admin/resolve-market
 */

type AdminCheck = {
  isAdmin: boolean
  userId?: string
  email?: string
  error?: string
}

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

function formatDate(value?: string | null) {
  if (!value) return "Not set"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return "Not set"

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

  if (status === "closed") {
    return "bg-slate-100 text-slate-700 ring-slate-200"
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

export default function AdminPage() {
  const devToolsUiEnabled =
    process.env.NEXT_PUBLIC_QWIKEER_DEV_TOOLS_ENABLED === "true"

  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminEmail, setAdminEmail] = useState("")
  const [adminUserId, setAdminUserId] = useState("")
  const [adminError, setAdminError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<
    "markets" | "balance" | "resolve"
  >("markets")

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("General")
  const [closesAt, setClosesAt] = useState("")
  const [status, setStatus] = useState("open")

  const [markets, setMarkets] = useState<AdminMarket[]>([])
  const [loadingMarkets, setLoadingMarkets] = useState(false)
  const [creating, setCreating] = useState(false)

  const [targetUserId, setTargetUserId] = useState("")
  const [amountCents, setAmountCents] = useState("100000")
  const [crediting, setCrediting] = useState(false)

  const [selectedMarketId, setSelectedMarketId] = useState("")
  const [selectedOutcomeId, setSelectedOutcomeId] = useState("")
  const [resolutionNote, setResolutionNote] = useState("")
  const [resolving, setResolving] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const openMarketsCount = useMemo(() => {
    return markets.filter((market) => market.status === "open").length
  }, [markets])

  const resolvedMarketsCount = useMemo(() => {
    return markets.filter((market) => market.status === "resolved").length
  }, [markets])

  const unresolvedMarkets = useMemo(() => {
    return markets.filter(
      (market) => market.status !== "resolved" && market.status !== "cancelled"
    )
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

  const totalMarketsCount = markets.length

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    return session?.access_token ?? null
  }

  async function checkAdmin() {
    try {
      setCheckingAdmin(true)
      setAdminError(null)

      const accessToken = await getAccessToken()

      if (!accessToken) {
        setIsAdmin(false)
        setAdminError("You are not logged in. Please login first.")
        return
      }

      const res = await fetch("/api/admin/me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      const contentType = res.headers.get("content-type") || ""

      if (!contentType.includes("application/json")) {
        const text = await res.text()
        console.error("Non-JSON response from /api/admin/me:", text.slice(0, 500))
        throw new Error(
          `/api/admin/me returned non-JSON response. Status: ${res.status}`
        )
      }

      const data: AdminCheck = await res.json()

      if (!res.ok || !data.isAdmin) {
        setIsAdmin(false)
        setAdminError(data.error || "Access denied. This account is not an admin.")
        return
      }

      setIsAdmin(true)
      setAdminEmail(data.email ?? "")
      setAdminUserId(data.userId ?? "")

      if (data.userId) {
        setTargetUserId(data.userId)
      }
    } catch (error) {
      setIsAdmin(false)
      setAdminError(
        error instanceof Error ? error.message : "Failed to check admin access."
      )
    } finally {
      setCheckingAdmin(false)
    }
  }

  async function fetchMarkets() {
    try {
      setLoadingMarkets(true)
      setError(null)

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
        console.error("Non-JSON response from /api/admin/markets:", text.slice(0, 500))
        throw new Error(
          `/api/admin/markets returned non-JSON response. Status: ${res.status}`
        )
      }

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Could not load markets.")
      }

      const loadedMarkets: AdminMarket[] = data.markets ?? []
      setMarkets(loadedMarkets)

      if (!selectedMarketId) {
        const firstUnresolved = loadedMarkets.find(
          (market) =>
            market.status !== "resolved" && market.status !== "cancelled"
        )

        if (firstUnresolved) {
          setSelectedMarketId(firstUnresolved.id)
          setSelectedOutcomeId(firstUnresolved.outcomes?.[0]?.id ?? "")
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load markets.")
      setMarkets([])
    } finally {
      setLoadingMarkets(false)
    }
  }

  async function createMarket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setCreating(true)
      setError(null)
      setSuccess(null)

      const accessToken = await getAccessToken()

      if (!accessToken) {
        throw new Error("Please login first.")
      }

      if (!title.trim()) {
        throw new Error("Market title is required.")
      }

      const res = await fetch("/api/admin/markets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title,
          description,
          category,
          closesAt: closesAt || null,
          status,
        }),
      })

      const contentType = res.headers.get("content-type") || ""

      if (!contentType.includes("application/json")) {
        const text = await res.text()
        console.error("Non-JSON response from /api/admin/markets:", text.slice(0, 500))
        throw new Error(
          `/api/admin/markets returned non-JSON response. Status: ${res.status}`
        )
      }

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to create market.")
      }

      setSuccess("Market created successfully with YES and NO outcomes.")

      setTitle("")
      setDescription("")
      setCategory("General")
      setClosesAt("")
      setStatus("open")

      await fetchMarkets()
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to create market.")
    } finally {
      setCreating(false)
    }
  }

  async function creditBalance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setCrediting(true)
      setError(null)
      setSuccess(null)

      const accessToken = await getAccessToken()

      if (!accessToken) {
        throw new Error("Please login first.")
      }

      if (!devToolsUiEnabled) {
        throw new Error("Development tools are disabled.")
      }

      if (!targetUserId.trim()) {
        throw new Error("Target user ID is required.")
      }

      const amount = Number(amountCents)

      if (!Number.isInteger(amount) || amount <= 0) {
        throw new Error("Amount must be a positive number of cents.")
      }

      const res = await fetch("/api/admin/credit-balance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          targetUserId: targetUserId.trim(),
          amountCents: amount,
        }),
      })

      const contentType = res.headers.get("content-type") || ""

      if (!contentType.includes("application/json")) {
        const text = await res.text()
        console.error(
          "Non-JSON response from /api/admin/credit-balance:",
          text.slice(0, 500)
        )
        throw new Error(
          `/api/admin/credit-balance returned non-JSON response. Status: ${res.status}`
        )
      }

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to credit balance.")
      }

      setSuccess(
        `Credited ${formatMoneyFromCents(amount)} demo balance successfully.`
      )
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to credit balance.")
    } finally {
      setCrediting(false)
    }
  }

  function handleSelectMarket(marketId: string) {
    setSelectedMarketId(marketId)

    const market = markets.find((item) => item.id === marketId)
    const firstOutcome = market?.outcomes?.[0]

    setSelectedOutcomeId(firstOutcome?.id ?? "")
  }

  async function resolveMarket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setResolving(true)
      setError(null)
      setSuccess(null)

      const accessToken = await getAccessToken()

      if (!accessToken) {
        throw new Error("Please login first.")
      }

      if (!selectedMarketId) {
        throw new Error("Please select a market.")
      }

      if (!selectedOutcomeId) {
        throw new Error("Please select the winning outcome.")
      }

      if (!selectedMarket) {
        throw new Error("Selected market not found.")
      }

      if (selectedMarket.status === "resolved") {
        throw new Error("This market is already resolved.")
      }

      if (!selectedMarket.outcomes || selectedMarket.outcomes.length < 2) {
        throw new Error("Market must have YES and NO outcomes before resolution.")
      }

      const confirmed = window.confirm(
        `Resolve this market as ${
          selectedOutcome?.code ?? "selected outcome"
        }?\n\nThis action pays winners and cannot be safely undone.`
      )

      if (!confirmed) {
        return
      }

      const res = await fetch("/api/admin/resolve-market", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          marketId: selectedMarketId,
          winningOutcomeId: selectedOutcomeId,
          resolutionNote,
        }),
      })

      const contentType = res.headers.get("content-type") || ""

      if (!contentType.includes("application/json")) {
        const text = await res.text()
        console.error(
          "Non-JSON response from /api/admin/resolve-market:",
          text.slice(0, 500)
        )
        throw new Error(
          `/api/admin/resolve-market returned non-JSON response. Status: ${res.status}`
        )
      }

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to resolve market.")
      }

      const totalPayout = Number(data.result?.total_payout_cents ?? 0)
      const totalRefund = Number(data.result?.total_refund_cents ?? 0)

      setSuccess(
        `Market resolved successfully. Payout: ${formatMoneyFromCents(
          totalPayout
        )}, refunds: ${formatMoneyFromCents(totalRefund)}.`
      )

      setResolutionNote("")
      setSelectedMarketId("")
      setSelectedOutcomeId("")

      await fetchMarkets()
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to resolve market.")
    } finally {
      setResolving(false)
    }
  }

  useEffect(() => {
    checkAdmin()
  }, [])

  useEffect(() => {
    if (isAdmin) {
      fetchMarkets()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  useEffect(() => {
    if (!devToolsUiEnabled && activeTab === "balance") {
      setActiveTab("markets")
    }
  }, [devToolsUiEnabled, activeTab])

  if (checkingAdmin) {
    return (
      <main className="p-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">
            Checking admin access...
          </p>
        </section>
      </main>
    )
  }

  if (!isAdmin) {
    return (
      <main className="p-6">
        <section className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
          <h1 className="text-xl font-black">Access denied</h1>

          <p className="mt-2 text-sm font-semibold">
            {adminError ?? "You do not have permission to access this page."}
          </p>

          <p className="mt-4 text-sm text-red-600">
            Login first, then make sure your Supabase Auth user ID exists in
            public.market_admins.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/login"
              className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white"
            >
              Go to Login
            </Link>

            <Link
              href="/"
              className="rounded-2xl border border-red-200 bg-white px-5 py-3 text-sm font-black text-red-700"
            >
              Back home
            </Link>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-600">
                Qwikeer Admin
              </p>

              <h1 className="mt-2 text-4xl font-black tracking-[-0.06em] text-slate-950 md:text-6xl">
                Market management
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Create markets, credit demo balances, and resolve Qwikeer
                markets after real-world outcomes are known.
              </p>

              {adminEmail && (
                <p className="mt-3 text-xs font-bold text-slate-400">
                  Logged in admin: {adminEmail}
                </p>
              )}

              {adminUserId && (
                <p className="mt-1 break-all text-xs font-bold text-slate-400">
                  Your user ID: {adminUserId}
                </p>
              )}

              {!devToolsUiEnabled && (
                <p className="mt-3 text-xs font-bold text-emerald-700">
                  Production-safe UI: dev-only tools are hidden.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={fetchMarkets}
                disabled={loadingMarkets}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                {loadingMarkets ? "Refreshing..." : "Refresh"}
              </button>

              <Link
                href="/markets"
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
              >
                View markets
              </Link>

              {devToolsUiEnabled && (
                <Link
                  href="/admin/liquidity"
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                >
                  Liquidity tool
                </Link>
              )}

              <Link
                href="/admin/cancel-market"
                className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-black text-red-700 transition hover:bg-red-100"
              >
                Cancel market
              </Link>

              <Link
                href="/admin/money-requests"
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Money requests
              </Link>

              <Link
                href="/admin/users"
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Users
              </Link>

              <Link
                href="/admin/audit-logs"
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Audit logs
              </Link>

              <Link
                href="/admin/environment"
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Environment
              </Link>

              <Link
                href="/admin/production-checklist"
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Production checklist
              </Link>
              <Link
                href="/admin/backup-restore"
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Backup / Restore
              </Link>
            </div>
          </div>
        </section>

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

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Total markets
            </p>

            <p className="mt-3 text-4xl font-black tracking-[-0.06em] text-slate-950">
              {totalMarketsCount}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Open markets
            </p>

            <p className="mt-3 text-4xl font-black tracking-[-0.06em] text-slate-950">
              {openMarketsCount}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Resolved markets
            </p>

            <p className="mt-3 text-4xl font-black tracking-[-0.06em] text-slate-950">
              {resolvedMarketsCount}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
          <div
            className={`grid gap-2 ${
              devToolsUiEnabled ? "sm:grid-cols-3" : "sm:grid-cols-2"
            }`}
          >
            <button
              type="button"
              onClick={() => setActiveTab("markets")}
              className={`rounded-2xl px-5 py-3 text-sm font-black transition ${
                activeTab === "markets"
                  ? "bg-slate-950 text-white"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              Markets
            </button>

            {devToolsUiEnabled && (
              <button
                type="button"
                onClick={() => setActiveTab("balance")}
                className={`rounded-2xl px-5 py-3 text-sm font-black transition ${
                  activeTab === "balance"
                    ? "bg-slate-950 text-white"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                Credit Balance
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab("resolve")}
              className={`rounded-2xl px-5 py-3 text-sm font-black transition ${
                activeTab === "resolve"
                  ? "bg-slate-950 text-white"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              Resolve Market
            </button>
          </div>
        </section>

        {activeTab === "markets" && (
          <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
            <form
              onSubmit={createMarket}
              className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
                Create market
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Create a binary YES/NO prediction market.
              </p>

              <label className="mt-5 block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Market title
                </span>

                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Example: Will APR FC win their next match?"
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />
              </label>

              <label className="mt-4 block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Description
                </span>

                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Explain how this market will resolve."
                  rows={5}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />
              </label>

              <label className="mt-4 block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Category
                </span>

                <input
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  placeholder="Sports, Crypto, Politics..."
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
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
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                  >
                    <option value="open">Open</option>
                    <option value="draft">Draft</option>
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
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={creating}
                className="mt-6 w-full rounded-2xl bg-[#FF7A1A] px-5 py-4 text-sm font-black text-white shadow-sm transition hover:bg-[#E85F00] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating ? "Creating market..." : "Create market"}
              </button>

              <p className="mt-4 text-xs leading-5 text-slate-500">
                Qwikeer automatically creates YES and NO outcomes for every
                market created here.
              </p>
            </form>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
                Markets
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Latest markets created in Qwikeer.
              </p>

              {markets.length === 0 ? (
                <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                  <p className="text-sm font-black text-slate-700">
                    No markets yet.
                  </p>

                  <p className="mt-2 text-sm text-slate-500">
                    Create your first Qwikeer market using the form.
                  </p>
                </div>
              ) : (
                <div className="mt-6 space-y-3">
                  {markets.map((market) => {
                    const yesExists = market.outcomes.some(
                      (outcome) => String(outcome.code).toUpperCase() === "YES"
                    )

                    const noExists = market.outcomes.some(
                      (outcome) => String(outcome.code).toUpperCase() === "NO"
                    )

                    const resolvedOutcome = market.outcomes.find(
                      (outcome) => outcome.id === market.resolved_outcome_id
                    )

                    return (
                      <div
                        key={market.id}
                        className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap gap-2">
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${statusClass(
                                  market.status
                                )}`}
                              >
                                {market.status}
                              </span>

                              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200">
                                {market.category || "General"}
                              </span>

                              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200">
                                Closes: {formatDate(market.closes_at)}
                              </span>

                              {resolvedOutcome && (
                                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700 ring-1 ring-blue-200">
                                  Winner: {resolvedOutcome.code}
                                </span>
                              )}
                            </div>

                            <h3 className="mt-3 text-lg font-black tracking-[-0.03em] text-slate-950">
                              {market.title}
                            </h3>

                            <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                              {market.description || "No description provided."}
                            </p>

                            <div className="mt-3 flex flex-wrap gap-2">
                              {market.outcomes.map((outcome) => (
                                <span
                                  key={outcome.id}
                                  className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200"
                                >
                                  {outcome.code}
                                </span>
                              ))}
                            </div>

                            {market.resolution_note && (
                              <p className="mt-3 text-xs font-semibold text-slate-500">
                                Resolution note: {market.resolution_note}
                              </p>
                            )}

                            {(!yesExists || !noExists) && (
                              <p className="mt-3 text-xs font-bold text-amber-700">
                                Warning: this market is missing YES/NO outcomes.
                              </p>
                            )}
                          </div>

                          <div className="flex flex-col gap-2 sm:min-w-[140px]">
                            <Link
                              href={`/markets/${market.id}`}
                              className="rounded-2xl bg-slate-950 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-slate-800"
                            >
                              Open
                            </Link>

                            <Link
                              href={`/admin/markets/${market.id}`}
                              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-black text-slate-700 transition hover:bg-slate-50"
                            >
                              Edit
                            </Link>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </section>
        )}

        {devToolsUiEnabled && activeTab === "balance" && (
          <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
            <form
              onSubmit={creditBalance}
              className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
                Credit demo balance
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Add testing balance to a user wallet. This is hidden when
                NEXT_PUBLIC_QWIKEER_DEV_TOOLS_ENABLED=false.
              </p>

              <label className="mt-5 block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Target user ID
                </span>

                <input
                  value={targetUserId}
                  onChange={(event) => setTargetUserId(event.target.value)}
                  placeholder="Supabase Auth user ID"
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  For testing, this is prefilled with your admin user ID.
                </p>
              </label>

              <label className="mt-4 block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Amount in cents
                </span>

                <input
                  value={amountCents}
                  onChange={(event) => setAmountCents(event.target.value)}
                  inputMode="numeric"
                  placeholder="100000"
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Preview: {formatMoneyFromCents(Number(amountCents || 0))}
                </p>
              </label>

              <button
                type="submit"
                disabled={crediting}
                className="mt-6 w-full rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {crediting ? "Crediting balance..." : "Credit balance"}
              </button>
            </form>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
                Testing guide
              </h2>

              <div className="mt-5 space-y-4 text-sm leading-6 text-slate-600">
                <p>
                  <strong>1.</strong> Credit your own user ID with demo balance.
                </p>

                <p>
                  <strong>2.</strong> Go to a market detail page and place a BUY
                  order.
                </p>

                <p>
                  <strong>3.</strong> Mint complete sets to receive YES and NO
                  shares.
                </p>

                <p>
                  <strong>4.</strong> Use those shares to place SELL orders.
                </p>

                <p>
                  <strong>5.</strong> Use a second account to test real matching
                  between different users.
                </p>
              </div>
            </section>
          </section>
        )}

        {activeTab === "resolve" && (
          <section className="grid gap-6 lg:grid-cols-[460px_1fr]">
            <form
              onSubmit={resolveMarket}
              className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
                Resolve market
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Select the winning outcome. The database engine will settle
                payouts and refunds.
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

                  {unresolvedMarkets.map((market) => (
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

                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">
                      Closes: {formatDate(selectedMarket.closes_at)}
                    </span>
                  </div>
                </div>
              )}

              <label className="mt-5 block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Winning outcome
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

              <label className="mt-4 block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Resolution note
                </span>

                <textarea
                  value={resolutionNote}
                  onChange={(event) => setResolutionNote(event.target.value)}
                  placeholder="Example: APR FC won the match 2-1 according to official final score."
                  rows={5}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />
              </label>

              <button
                type="submit"
                disabled={resolving || !selectedMarketId || !selectedOutcomeId}
                className="mt-6 w-full rounded-2xl bg-blue-600 px-5 py-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resolving ? "Resolving market..." : "Resolve and pay winners"}
              </button>

              <p className="mt-4 text-xs leading-5 text-red-600">
                Important: market resolution pays winners and clears positions.
                Do not resolve until you are sure of the real-world result.
              </p>
            </form>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
                Resolution checklist
              </h2>

              <div className="mt-5 space-y-4 text-sm leading-6 text-slate-600">
                <p>
                  <strong>1.</strong> Confirm the market result from a trusted
                  source.
                </p>

                <p>
                  <strong>2.</strong> Select the correct Qwikeer market.
                </p>

                <p>
                  <strong>3.</strong> Select the winning outcome: YES or NO.
                </p>

                <p>
                  <strong>4.</strong> Add a clear resolution note.
                </p>

                <p>
                  <strong>5.</strong> Resolve. Open orders are cancelled,
                  locked funds/shares are released, and winning positions are
                  paid at 100 cents per share.
                </p>
              </div>

              <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold leading-6 text-amber-800">
                If you resolve a market incorrectly, do not manually edit wallet
                balances. Later we should build an admin correction and audit
                flow.
              </div>
            </section>
          </section>
        )}
      </div>
    </main>
  )
}