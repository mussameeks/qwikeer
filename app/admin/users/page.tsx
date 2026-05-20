"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

/**
 * Qwikeer Admin Users Page
 *
 * Admin can:
 * - view user profiles
 * - search users
 * - update verification status
 * - set deposit/withdrawal limits
 */

type UserProfile = {
  user_id: string
  email?: string | null
  full_name?: string | null
  phone_number?: string | null
  country?: string | null
  verification_status: string
  deposit_limit_cents: number
  withdrawal_limit_cents: number
  admin_note?: string | null
  rejection_reason?: string | null
  wallet?: {
    available_cents: number
    locked_cents: number
  } | null
}

type UsersResponse = {
  profiles: UserProfile[]
  error?: string
}

function formatMoneyFromCents(value: number) {
  return `${(Number(value || 0) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function statusClass(status: string) {
  if (status === "verified") return "bg-emerald-50 text-emerald-700 ring-emerald-200"
  if (status === "pending") return "bg-amber-50 text-amber-700 ring-amber-200"
  if (status === "rejected") return "bg-red-50 text-red-700 ring-red-200"
  if (status === "suspended") return "bg-slate-900 text-white ring-slate-900"
  return "bg-slate-100 text-slate-700 ring-slate-200"
}

export default function AdminUsersPage() {
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [selectedUserId, setSelectedUserId] = useState("")

  const [statusFilter, setStatusFilter] = useState("all")
  const [search, setSearch] = useState("")

  const [verificationStatus, setVerificationStatus] = useState("unverified")
  const [depositLimitCents, setDepositLimitCents] = useState("0")
  const [withdrawalLimitCents, setWithdrawalLimitCents] = useState("0")
  const [adminNote, setAdminNote] = useState("")
  const [rejectionReason, setRejectionReason] = useState("")

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const selectedProfile = useMemo(() => {
    return profiles.find((profile) => profile.user_id === selectedUserId) ?? null
  }, [profiles, selectedUserId])

  const pendingCount = useMemo(() => {
    return profiles.filter((profile) => profile.verification_status === "pending").length
  }, [profiles])

  const verifiedCount = useMemo(() => {
    return profiles.filter((profile) => profile.verification_status === "verified").length
  }, [profiles])

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    return session?.access_token ?? null
  }

  async function fetchUsers(options?: { silent?: boolean }) {
    try {
      if (options?.silent) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError("")

      const accessToken = await getAccessToken()

      if (!accessToken) {
        setProfiles([])
        throw new Error("Please login first.")
      }

      const params = new URLSearchParams({
        status: statusFilter,
        search,
      })

      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      const contentType = res.headers.get("content-type") || ""

      if (!contentType.includes("application/json")) {
        const text = await res.text()
        console.error("Non-JSON response from /api/admin/users:", text.slice(0, 500))
        throw new Error(`/api/admin/users returned non-JSON response. Status: ${res.status}`)
      }

      const data: UsersResponse = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Could not load users.")
      }

      setProfiles(data.profiles ?? [])
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load users.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  function selectProfile(profile: UserProfile) {
    setSelectedUserId(profile.user_id)
    setVerificationStatus(profile.verification_status)
    setDepositLimitCents(String(profile.deposit_limit_cents ?? 0))
    setWithdrawalLimitCents(String(profile.withdrawal_limit_cents ?? 0))
    setAdminNote(profile.admin_note ?? "")
    setRejectionReason(profile.rejection_reason ?? "")
  }

  async function updateProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setSaving(true)
      setError("")
      setSuccess("")

      const accessToken = await getAccessToken()

      if (!accessToken) {
        throw new Error("Please login first.")
      }

      if (!selectedUserId) {
        throw new Error("Please select a user.")
      }

      const depositLimit = Number(depositLimitCents)
      const withdrawalLimit = Number(withdrawalLimitCents)

      if (
        !Number.isInteger(depositLimit) ||
        depositLimit < 0 ||
        !Number.isInteger(withdrawalLimit) ||
        withdrawalLimit < 0
      ) {
        throw new Error("Limits must be positive integer cents.")
      }

      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          targetUserId: selectedUserId,
          verificationStatus,
          depositLimitCents: depositLimit,
          withdrawalLimitCents: withdrawalLimit,
          adminNote,
          rejectionReason,
        }),
      })

      const contentType = res.headers.get("content-type") || ""

      if (!contentType.includes("application/json")) {
        const text = await res.text()
        console.error("Non-JSON response from PATCH /api/admin/users:", text.slice(0, 500))
        throw new Error(`PATCH /api/admin/users returned non-JSON response. Status: ${res.status}`)
      }

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Could not update user.")
      }

      setSuccess("User profile updated successfully.")
      await fetchUsers({ silent: true })
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not update user.")
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    fetchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  if (loading) {
    return (
      <main className="p-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Loading admin users...</p>
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
                User management.
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Review user profiles, update verification status, and manage deposit/withdrawal limits.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fetchUsers({ silent: true })}
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

        {success && (
          <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-semibold text-emerald-700">
            {success}
          </section>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Users shown
            </p>
            <p className="mt-3 text-4xl font-black tracking-[-0.06em] text-slate-950">
              {profiles.length}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Pending
            </p>
            <p className="mt-3 text-4xl font-black tracking-[-0.06em] text-amber-700">
              {pendingCount}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Verified
            </p>
            <p className="mt-3 text-4xl font-black tracking-[-0.06em] text-emerald-700">
              {verifiedCount}
            </p>
          </div>
        </section>

        <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[240px_1fr_auto]">
          <label>
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">
              Status
            </span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
            >
              <option value="all">All</option>
              <option value="unverified">Unverified</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
              <option value="suspended">Suspended</option>
            </select>
          </label>

          <label>
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">
              Search
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search email, name, phone..."
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
            />
          </label>

          <button
            type="button"
            onClick={() => fetchUsers({ silent: true })}
            className="self-end rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white"
          >
            Search
          </button>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
              Users
            </h2>

            {profiles.length === 0 ? (
              <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">
                No users found.
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {profiles.map((profile) => (
                  <button
                    key={profile.user_id}
                    type="button"
                    onClick={() => selectProfile(profile)}
                    className={`w-full rounded-3xl border p-5 text-left transition ${
                      selectedUserId === profile.user_id
                        ? "border-orange-300 bg-orange-50"
                        : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-black text-slate-950">
                          {profile.full_name || profile.email || "Unnamed user"}
                        </p>

                        <p className="mt-1 break-all text-xs font-semibold text-slate-400">
                          {profile.email || profile.user_id}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black capitalize ring-1 ${statusClass(
                              profile.verification_status
                            )}`}
                          >
                            {profile.verification_status}
                          </span>

                          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">
                            {profile.country || "No country"}
                          </span>
                        </div>
                      </div>

                      <div className="text-sm font-bold text-slate-600">
                        <p>Available: {formatMoneyFromCents(profile.wallet?.available_cents ?? 0)}</p>
                        <p className="mt-1">Locked: {formatMoneyFromCents(profile.wallet?.locked_cents ?? 0)}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={updateProfile}
            className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
              Review user
            </h2>

            {!selectedProfile ? (
              <p className="mt-4 text-sm font-semibold text-slate-500">
                Select a user from the list.
              </p>
            ) : (
              <>
                <p className="mt-3 break-all text-xs font-semibold text-slate-400">
                  User ID: {selectedProfile.user_id}
                </p>

                <label className="mt-5 block">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Verification status
                  </span>
                  <select
                    value={verificationStatus}
                    onChange={(event) => setVerificationStatus(event.target.value)}
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                  >
                    <option value="unverified">Unverified</option>
                    <option value="pending">Pending</option>
                    <option value="verified">Verified</option>
                    <option value="rejected">Rejected</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </label>

                <label className="mt-4 block">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Deposit limit cents
                  </span>
                  <input
                    value={depositLimitCents}
                    onChange={(event) => setDepositLimitCents(event.target.value)}
                    inputMode="numeric"
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Preview: {formatMoneyFromCents(Number(depositLimitCents || 0))}
                  </p>
                </label>

                <label className="mt-4 block">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Withdrawal limit cents
                  </span>
                  <input
                    value={withdrawalLimitCents}
                    onChange={(event) => setWithdrawalLimitCents(event.target.value)}
                    inputMode="numeric"
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Preview: {formatMoneyFromCents(Number(withdrawalLimitCents || 0))}
                  </p>
                </label>

                <label className="mt-4 block">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Admin note
                  </span>
                  <textarea
                    value={adminNote}
                    onChange={(event) => setAdminNote(event.target.value)}
                    rows={4}
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                  />
                </label>

                <label className="mt-4 block">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Rejection reason
                  </span>
                  <textarea
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    rows={3}
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                  />
                </label>

                <button
                  type="submit"
                  disabled={saving}
                  className="mt-6 w-full rounded-2xl bg-[#FF7A1A] px-5 py-4 text-sm font-black text-white shadow-sm transition hover:bg-[#E85F00] disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save user review"}
                </button>
              </>
            )}
          </form>
        </section>
      </div>
    </main>
  )
}