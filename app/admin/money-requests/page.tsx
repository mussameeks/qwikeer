"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

/**
 * Qwikeer Admin Money Requests Page
 *
 * Admin can:
 * - view deposit/withdrawal requests
 * - approve deposits
 * - reject deposits
 * - approve withdrawals
 * - reject withdrawals
 *
 * Wallet movement is handled by:
 * - public.review_money_request()
 */

type MoneyRequest = {
  id: string
  user_id: string
  type: "deposit" | "withdrawal"
  status: "pending" | "approved" | "rejected" | "cancelled"
  amount_cents: number
  payment_method?: string | null
  payment_reference?: string | null
  account_name?: string | null
  account_number?: string | null
  user_note?: string | null
  reviewed_by?: string | null
  reviewed_at?: string | null
  admin_note?: string | null
  created_at: string
  updated_at?: string | null
}

type AdminRequestsResponse = {
  requests: MoneyRequest[]
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

function statusClass(status: string) {
  if (status === "pending") {
    return "bg-amber-50 text-amber-700 ring-amber-200"
  }

  if (status === "approved") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200"
  }

  if (status === "rejected") {
    return "bg-red-50 text-red-700 ring-red-200"
  }

  return "bg-slate-100 text-slate-700 ring-slate-200"
}

function typeClass(type: string) {
  if (type === "deposit") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200"
  }

  return "bg-blue-50 text-blue-700 ring-blue-200"
}

export default function AdminMoneyRequestsPage() {
  const [requests, setRequests] = useState<MoneyRequest[]>([])
  const [statusFilter, setStatusFilter] = useState<
    "pending" | "approved" | "rejected" | "cancelled" | "all"
  >("pending")

  const [adminNote, setAdminNote] = useState("")
  const [reviewingId, setReviewingId] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const pendingCount = useMemo(() => {
    return requests.filter((request) => request.status === "pending").length
  }, [requests])

  const depositPendingCents = useMemo(() => {
    return requests
      .filter(
        (request) =>
          request.status === "pending" && request.type === "deposit"
      )
      .reduce((sum, request) => sum + Number(request.amount_cents || 0), 0)
  }, [requests])

  const withdrawalPendingCents = useMemo(() => {
    return requests
      .filter(
        (request) =>
          request.status === "pending" && request.type === "withdrawal"
      )
      .reduce((sum, request) => sum + Number(request.amount_cents || 0), 0)
  }, [requests])

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    return session?.access_token ?? null
  }

  async function fetchRequests(options?: { silent?: boolean }) {
    try {
      if (options?.silent) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError("")

      const accessToken = await getAccessToken()

      if (!accessToken) {
        setRequests([])
        throw new Error("Please login first.")
      }

      const res = await fetch(
        `/api/admin/money-requests?status=${statusFilter}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      const contentType = res.headers.get("content-type") || ""

      if (!contentType.includes("application/json")) {
        const text = await res.text()
        console.error(
          "Non-JSON response from /api/admin/money-requests:",
          text.slice(0, 500)
        )
        throw new Error(
          `/api/admin/money-requests returned non-JSON response. Status: ${res.status}`
        )
      }

      const data: AdminRequestsResponse = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Could not load money requests.")
      }

      setRequests(data.requests ?? [])
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not load money requests."
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function reviewRequest(
    request: MoneyRequest,
    decision: "approved" | "rejected"
  ) {
    try {
      setReviewingId(request.id)
      setError("")
      setSuccess("")

      const confirmed = window.confirm(
        `${decision === "approved" ? "Approve" : "Reject"} this ${
          request.type
        } request for ${formatMoneyFromCents(request.amount_cents)}?`
      )

      if (!confirmed) return

      const accessToken = await getAccessToken()

      if (!accessToken) {
        throw new Error("Please login first.")
      }

      const res = await fetch("/api/admin/money-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          requestId: request.id,
          decision,
          adminNote,
        }),
      })

      const contentType = res.headers.get("content-type") || ""

      if (!contentType.includes("application/json")) {
        const text = await res.text()
        console.error(
          "Non-JSON response from POST /api/admin/money-requests:",
          text.slice(0, 500)
        )
        throw new Error(
          `POST /api/admin/money-requests returned non-JSON response. Status: ${res.status}`
        )
      }

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Could not review request.")
      }

      setSuccess(
        `${request.type} request ${decision} successfully.`
      )

      setAdminNote("")
      await fetchRequests({ silent: true })
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not review request."
      )
    } finally {
      setReviewingId(null)
    }
  }

  useEffect(() => {
    fetchRequests()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  if (loading) {
    return (
      <main className="p-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">
            Loading admin money requests...
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
                Money requests.
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Review manual deposit and withdrawal requests before funds move
                in or out of user wallets.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fetchRequests({ silent: true })}
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

        {/* Summary */}
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Pending count
            </p>
            <p className="mt-3 text-4xl font-black tracking-[-0.06em] text-slate-950">
              {pendingCount}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Pending deposits
            </p>
            <p className="mt-3 text-4xl font-black tracking-[-0.06em] text-emerald-700">
              {formatMoneyFromCents(depositPendingCents)}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Pending withdrawals
            </p>
            <p className="mt-3 text-4xl font-black tracking-[-0.06em] text-blue-700">
              {formatMoneyFromCents(withdrawalPendingCents)}
            </p>
          </div>
        </section>

        {/* Filter + admin note */}
        <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[260px_1fr]">
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
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
              <option value="all">All</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">
              Admin note for next review
            </span>

            <input
              value={adminNote}
              onChange={(event) => setAdminNote(event.target.value)}
              placeholder="Optional note saved when approving/rejecting"
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
            />
          </label>
        </section>

        {/* Requests */}
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
            Requests
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Showing {requests.length} request{requests.length === 1 ? "" : "s"}.
          </p>

          {requests.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <p className="text-sm font-black text-slate-700">
                No requests found.
              </p>

              <p className="mt-2 text-sm text-slate-500">
                User deposit and withdrawal requests will appear here.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {requests.map((request) => {
                const canReview = request.status === "pending"

                return (
                  <div
                    key={request.id}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black capitalize ring-1 ${typeClass(
                              request.type
                            )}`}
                          >
                            {request.type}
                          </span>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black capitalize ring-1 ${statusClass(
                              request.status
                            )}`}
                          >
                            {request.status}
                          </span>
                        </div>

                        <p className="mt-3 text-2xl font-black tracking-[-0.04em] text-slate-950">
                          {formatMoneyFromCents(request.amount_cents)}
                        </p>

                        <p className="mt-1 break-all text-xs font-semibold text-slate-400">
                          User ID: {request.user_id}
                        </p>

                        <p className="mt-1 text-xs font-semibold text-slate-400">
                          Created {formatDateTime(request.created_at)}
                        </p>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          {request.payment_method && (
                            <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                                Payment method
                              </p>
                              <p className="mt-1 text-sm font-bold text-slate-700">
                                {request.payment_method}
                              </p>
                            </div>
                          )}

                          {request.payment_reference && (
                            <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                                Payment reference
                              </p>
                              <p className="mt-1 text-sm font-bold text-slate-700">
                                {request.payment_reference}
                              </p>
                            </div>
                          )}

                          {request.account_name && (
                            <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                                Account name
                              </p>
                              <p className="mt-1 text-sm font-bold text-slate-700">
                                {request.account_name}
                              </p>
                            </div>
                          )}

                          {request.account_number && (
                            <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                                Account number
                              </p>
                              <p className="mt-1 text-sm font-bold text-slate-700">
                                {request.account_number}
                              </p>
                            </div>
                          )}
                        </div>

                        {request.user_note && (
                          <p className="mt-4 text-sm leading-6 text-slate-500">
                            User note: {request.user_note}
                          </p>
                        )}

                        {request.admin_note && (
                          <p className="mt-4 text-sm leading-6 text-slate-500">
                            Admin note: {request.admin_note}
                          </p>
                        )}

                        {request.reviewed_at && (
                          <p className="mt-3 text-xs font-semibold text-slate-400">
                            Reviewed {formatDateTime(request.reviewed_at)}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col justify-start gap-2">
                        {canReview ? (
                          <>
                            <button
                              type="button"
                              disabled={reviewingId === request.id}
                              onClick={() => reviewRequest(request, "approved")}
                              className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {reviewingId === request.id
                                ? "Reviewing..."
                                : "Approve"}
                            </button>

                            <button
                              type="button"
                              disabled={reviewingId === request.id}
                              onClick={() => reviewRequest(request, "rejected")}
                              className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Reject
                            </button>
                          </>
                        ) : (
                          <div className="rounded-2xl bg-white px-5 py-3 text-center text-sm font-black text-slate-500 ring-1 ring-slate-200">
                            Already {request.status}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}