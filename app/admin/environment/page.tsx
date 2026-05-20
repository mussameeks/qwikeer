"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

/**
 * Qwikeer Admin Environment Page
 *
 * Validates:
 * - required environment variables
 * - dev tools status
 * - required database tables
 * - RLS status
 * - required RPC functions
 */

type EnvVariable = {
  name: string
  required: boolean
  public: boolean
  configured: boolean
}

type DatabaseHealth = {
  ok: boolean
  missing_tables: string[]
  rls_disabled_tables: string[]
  missing_functions: string[]
  error?: string | null
}

type EnvironmentResponse = {
  ok: boolean
  environment: string
  devToolsEnabled: boolean
  publicDevToolsEnabled?: boolean
  variables: EnvVariable[]
  missingRequired: EnvVariable[]
  databaseHealth?: DatabaseHealth
  warnings: string[]
  error?: string
}

function statusClass(configured: boolean) {
  if (configured) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200"
  }

  return "bg-red-50 text-red-700 ring-red-200"
}

function healthClass(ok: boolean) {
  if (ok) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200"
  }

  return "bg-red-50 text-red-700 ring-red-200"
}

function prettyName(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export default function AdminEnvironmentPage() {
  const [data, setData] = useState<EnvironmentResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")

  const requiredConfiguredCount = useMemo(() => {
    return (
      data?.variables.filter((item) => item.required && item.configured)
        .length ?? 0
    )
  }, [data])

  const requiredTotalCount = useMemo(() => {
    return data?.variables.filter((item) => item.required).length ?? 0
  }, [data])

  const missingTablesCount = data?.databaseHealth?.missing_tables.length ?? 0
  const rlsDisabledCount = data?.databaseHealth?.rls_disabled_tables.length ?? 0
  const missingFunctionsCount =
    data?.databaseHealth?.missing_functions.length ?? 0

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    return session?.access_token ?? null
  }

  async function fetchEnvironment(options?: { silent?: boolean }) {
    try {
      if (options?.silent) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError("")

      const accessToken = await getAccessToken()

      if (!accessToken) {
        throw new Error("Please login first.")
      }

      const res = await fetch("/api/admin/environment", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      const contentType = res.headers.get("content-type") || ""

      if (!contentType.includes("application/json")) {
        const text = await res.text()
        console.error(
          "Non-JSON response from /api/admin/environment:",
          text.slice(0, 500)
        )
        throw new Error(
          `/api/admin/environment returned non-JSON response. Status: ${res.status}`
        )
      }

      const responseData: EnvironmentResponse = await res.json()

      if (!res.ok) {
        throw new Error(responseData.error || "Could not load environment.")
      }

      setData(responseData)
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not load environment."
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchEnvironment()
  }, [])

  if (loading) {
    return (
      <main className="p-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">
            Checking environment...
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-600">
                Qwikeer Admin
              </p>

              <h1 className="mt-2 text-4xl font-black tracking-[-0.06em] text-slate-950 md:text-6xl">
                Environment check.
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Verify production-critical environment variables and database
                health without exposing secret values.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fetchEnvironment({ silent: true })}
                disabled={refreshing}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>

              <Link
                href="/admin/production-checklist"
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Checklist
              </Link>

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

        {data && (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Overall status
                </p>

                <p
                  className={`mt-3 text-4xl font-black tracking-[-0.06em] ${
                    data.ok ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {data.ok ? "OK" : "Needs fix"}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Required vars
                </p>

                <p className="mt-3 text-4xl font-black tracking-[-0.06em] text-slate-950">
                  {requiredConfiguredCount}/{requiredTotalCount}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Database
                </p>

                <p
                  className={`mt-3 text-4xl font-black tracking-[-0.06em] ${
                    data.databaseHealth?.ok
                      ? "text-emerald-700"
                      : "text-red-700"
                  }`}
                >
                  {data.databaseHealth?.ok ? "OK" : "Check"}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Dev tools
                </p>

                <p
                  className={`mt-3 text-4xl font-black tracking-[-0.06em] ${
                    data.devToolsEnabled ? "text-amber-700" : "text-emerald-700"
                  }`}
                >
                  {data.devToolsEnabled ? "ON" : "OFF"}
                </p>

                <p className="mt-2 text-xs font-bold text-slate-500">
                  UI: {data.publicDevToolsEnabled ? "visible" : "hidden"}
                </p>
              </div>
            </section>

            {data.warnings.length > 0 && (
              <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold leading-6 text-amber-800">
                <p className="font-black">Warnings</p>

                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {data.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </section>
            )}

            <section className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Missing tables
                </p>

                <p
                  className={`mt-3 text-4xl font-black tracking-[-0.06em] ${
                    missingTablesCount === 0
                      ? "text-emerald-700"
                      : "text-red-700"
                  }`}
                >
                  {missingTablesCount}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  RLS disabled
                </p>

                <p
                  className={`mt-3 text-4xl font-black tracking-[-0.06em] ${
                    rlsDisabledCount === 0
                      ? "text-emerald-700"
                      : "text-red-700"
                  }`}
                >
                  {rlsDisabledCount}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Missing functions
                </p>

                <p
                  className={`mt-3 text-4xl font-black tracking-[-0.06em] ${
                    missingFunctionsCount === 0
                      ? "text-emerald-700"
                      : "text-red-700"
                  }`}
                >
                  {missingFunctionsCount}
                </p>
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
                Environment variables
              </h2>

              <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-5 py-4">Name</th>
                        <th className="px-5 py-4">Status</th>
                        <th className="px-5 py-4">Required</th>
                        <th className="px-5 py-4">Visibility</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {data.variables.map((item) => (
                        <tr key={item.name} className="bg-white">
                          <td className="px-5 py-4 font-black text-slate-950">
                            {item.name}
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${statusClass(
                                item.configured
                              )}`}
                            >
                              {item.configured ? "Configured" : "Missing"}
                            </span>
                          </td>

                          <td className="px-5 py-4 font-bold text-slate-700">
                            {item.required ? "Required" : "Optional"}
                          </td>

                          <td className="px-5 py-4 font-bold text-slate-700">
                            {item.public ? "Public client var" : "Server secret"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
                    Database health
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    This section is powered by{" "}
                    <code className="rounded bg-slate-100 px-1 py-0.5">
                      public.qwikeer_database_health_check()
                    </code>
                    .
                  </p>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${healthClass(
                    Boolean(data.databaseHealth?.ok)
                  )}`}
                >
                  {data.databaseHealth?.ok ? "Healthy" : "Needs fix"}
                </span>
              </div>

              {data.databaseHealth?.error && (
                <div className="mt-5 rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold leading-6 text-red-700">
                  {data.databaseHealth.error}
                </div>
              )}

              <div className="mt-6 grid gap-4 lg:grid-cols-3">
                <HealthList
                  title="Missing tables"
                  items={data.databaseHealth?.missing_tables ?? []}
                  emptyLabel="No missing tables."
                />

                <HealthList
                  title="RLS disabled tables"
                  items={data.databaseHealth?.rls_disabled_tables ?? []}
                  emptyLabel="RLS enabled on required tables."
                />

                <HealthList
                  title="Missing functions"
                  items={data.databaseHealth?.missing_functions ?? []}
                  emptyLabel="No missing functions."
                />
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
                Recommended `.env.local`
              </h2>

              <pre className="mt-5 overflow-auto rounded-3xl bg-slate-950 p-5 text-xs font-semibold leading-6 text-white">
{`NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

QWIKEER_DEV_TOOLS_ENABLED=true
NEXT_PUBLIC_QWIKEER_DEV_TOOLS_ENABLED=true
QWIKEER_ENVIRONMENT=development
NEXT_PUBLIC_SITE_URL=http://localhost:3000`}
              </pre>

              <p className="mt-4 text-sm leading-6 text-slate-500">
                For production, set QWIKEER_DEV_TOOLS_ENABLED=false,
                NEXT_PUBLIC_QWIKEER_DEV_TOOLS_ENABLED=false, and set
                NEXT_PUBLIC_SITE_URL to your real domain.
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  )
}

function HealthList({
  title,
  items,
  emptyLabel,
}: {
  title: string
  items: string[]
  emptyLabel: string
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">
        {title}
      </h3>

      {items.length === 0 ? (
        <p className="mt-4 text-sm font-semibold text-emerald-700">
          {emptyLabel}
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item}
              className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700 ring-1 ring-red-200"
            >
              {prettyName(item)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}