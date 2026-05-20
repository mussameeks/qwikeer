"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

/**
 * Qwikeer Admin Audit Logs Page
 *
 * Admin can:
 * - view admin actions
 * - filter by action
 * - filter by target type
 *
 * This helps track who did what and when.
 */

type AuditLog = {
  id: string
  admin_user_id: string
  action: string
  target_type?: string | null
  target_id?: string | null
  summary?: string | null
  metadata?: Record<string, unknown> | null
  created_at: string
}

type AuditLogsResponse = {
  logs: AuditLog[]
  error?: string
}

const auditActions = [
  "all",
  "market_created",
  "market_updated",
  "market_deleted",
  "market_resolved",
  "market_cancelled",
  "deposit_approved",
  "deposit_rejected",
  "withdrawal_approved",
  "withdrawal_rejected",
  "demo_balance_credited",
  "liquidity_created",
  "user_profile_updated",
  "admin_action",
]

const targetTypes = [
  "all",
  "market",
  "user",
  "money_request",
  "wallet",
  "liquidity",
  "system",
]

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

function prettyLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function actionClass(action: string) {
  if (action.includes("approved") || action.includes("created")) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200"
  }

  if (action.includes("rejected") || action.includes("cancelled")) {
    return "bg-red-50 text-red-700 ring-red-200"
  }

  if (action.includes("resolved") || action.includes("updated")) {
    return "bg-blue-50 text-blue-700 ring-blue-200"
  }

  return "bg-slate-100 text-slate-700 ring-slate-200"
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])

  const [actionFilter, setActionFilter] = useState("all")
  const [targetTypeFilter, setTargetTypeFilter] = useState("all")

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [error, setError] = useState("")

  const marketActionsCount = useMemo(() => {
    return logs.filter((log) => log.target_type === "market").length
  }, [logs])

  const userActionsCount = useMemo(() => {
    return logs.filter((log) => log.target_type === "user").length
  }, [logs])

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    return session?.access_token ?? null
  }

  async function fetchLogs(options?: { silent?: boolean }) {
    try {
      if (options?.silent) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError("")

      const accessToken = await getAccessToken()

      if (!accessToken) {
        setLogs([])
        throw new Error("Please login first.")
      }

      const params = new URLSearchParams({
        action: actionFilter,
        targetType: targetTypeFilter,
      })

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      const contentType = res.headers.get("content-type") || ""

      if (!contentType.includes("application/json")) {
        const text = await res.text()
        console.error(
          "Non-JSON response from /api/admin/audit-logs:",
          text.slice(0, 500)
        )
        throw new Error(
          `/api/admin/audit-logs returned non-JSON response. Status: ${res.status}`
        )
      }

      const data: AuditLogsResponse = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Could not load audit logs.")
      }

      setLogs(data.logs ?? [])
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not load audit logs."
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter, targetTypeFilter])

  if (loading) {
    return (
      <main className="p-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">
            Loading admin audit logs...
          </p>
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
                Audit logs.
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Track sensitive admin actions across markets, users, deposits,
                withdrawals, liquidity, and system tools.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fetchLogs({ silent: true })}
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

        {error && (
          <section className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
            {error}
          </section>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Logs shown
            </p>
            <p className="mt-3 text-4xl font-black tracking-[-0.06em] text-slate-950">
              {logs.length}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Market actions
            </p>
            <p className="mt-3 text-4xl font-black tracking-[-0.06em] text-blue-700">
              {marketActionsCount}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              User actions
            </p>
            <p className="mt-3 text-4xl font-black tracking-[-0.06em] text-emerald-700">
              {userActionsCount}
            </p>
          </div>
        </section>

        <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2">
          <label>
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">
              Action
            </span>

            <select
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
            >
              {auditActions.map((action) => (
                <option key={action} value={action}>
                  {action === "all" ? "All actions" : prettyLabel(action)}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">
              Target type
            </span>

            <select
              value={targetTypeFilter}
              onChange={(event) => setTargetTypeFilter(event.target.value)}
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
            >
              {targetTypes.map((targetType) => (
                <option key={targetType} value={targetType}>
                  {targetType === "all"
                    ? "All targets"
                    : prettyLabel(targetType)}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
            Logs
          </h2>

          {logs.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <p className="text-sm font-black text-slate-700">
                No audit logs found.
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Admin actions will appear here after audit logging is added to
                each admin route.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${actionClass(
                            log.action
                          )}`}
                        >
                          {prettyLabel(log.action)}
                        </span>

                        {log.target_type && (
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">
                            {log.target_type}
                          </span>
                        )}
                      </div>

                      <p className="mt-3 text-sm font-black text-slate-950">
                        {log.summary || "No summary provided."}
                      </p>

                      <p className="mt-2 break-all text-xs font-semibold text-slate-400">
                        Admin: {log.admin_user_id}
                      </p>

                      {log.target_id && (
                        <p className="mt-1 break-all text-xs font-semibold text-slate-400">
                          Target: {log.target_id}
                        </p>
                      )}

                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <pre className="mt-4 max-h-56 overflow-auto rounded-2xl bg-white p-4 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      )}
                    </div>

                    <p className="text-xs font-bold text-slate-400">
                      {formatDateTime(log.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}