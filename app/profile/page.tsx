"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

/**
 * Qwikeer Profile Page
 *
 * User can:
 * - view account/profile
 * - update KYC readiness fields
 * - see verification status and limits
 */

type ProfileResponse = {
  user: {
    id: string
    email?: string
  } | null
  profile: {
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
  } | null
  wallet: {
    user_id: string
    available_cents: number
    locked_cents: number
  } | null
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

export default function ProfilePage() {
  const [profileData, setProfileData] = useState<ProfileResponse | null>(null)

  const [fullName, setFullName] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [country, setCountry] = useState("Rwanda")

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    return session?.access_token ?? null
  }

  async function fetchProfile() {
    try {
      setLoading(true)
      setError("")

      const accessToken = await getAccessToken()

      if (!accessToken) {
        setProfileData(null)
        throw new Error("Please login first.")
      }

      const res = await fetch("/api/profile", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      const contentType = res.headers.get("content-type") || ""

      if (!contentType.includes("application/json")) {
        const text = await res.text()
        console.error("Non-JSON response from /api/profile:", text.slice(0, 500))
        throw new Error(`/api/profile returned non-JSON response. Status: ${res.status}`)
      }

      const data: ProfileResponse = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Could not load profile.")
      }

      setProfileData(data)
      setFullName(data.profile?.full_name ?? "")
      setPhoneNumber(data.profile?.phone_number ?? "")
      setCountry(data.profile?.country ?? "Rwanda")
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load profile.")
    } finally {
      setLoading(false)
    }
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setSaving(true)
      setError("")
      setSuccess("")

      const accessToken = await getAccessToken()

      if (!accessToken) {
        throw new Error("Please login first.")
      }

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          fullName,
          phoneNumber,
          country,
        }),
      })

      const contentType = res.headers.get("content-type") || ""

      if (!contentType.includes("application/json")) {
        const text = await res.text()
        console.error("Non-JSON response from PATCH /api/profile:", text.slice(0, 500))
        throw new Error(`PATCH /api/profile returned non-JSON response. Status: ${res.status}`)
      }

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Could not update profile.")
      }

      setSuccess("Profile updated successfully.")
      await fetchProfile()
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not update profile.")
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    fetchProfile()
  }, [])

  if (loading) {
    return (
      <main className="p-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Loading profile...</p>
        </section>
      </main>
    )
  }

  return (
    <main className="p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-600">
            Qwikeer Profile
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-[-0.06em] text-slate-950 md:text-6xl">
            Account verification.
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            Keep your profile information updated. Admin verification and limits will be applied before real-money operations.
          </p>
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

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Status
            </p>

            <span
              className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-black capitalize ring-1 ${statusClass(
                profileData?.profile?.verification_status ?? "unverified"
              )}`}
            >
              {profileData?.profile?.verification_status ?? "unverified"}
            </span>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Available
            </p>
            <p className="mt-3 text-2xl font-black text-slate-950">
              {formatMoneyFromCents(profileData?.wallet?.available_cents ?? 0)}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Deposit limit
            </p>
            <p className="mt-3 text-2xl font-black text-slate-950">
              {formatMoneyFromCents(profileData?.profile?.deposit_limit_cents ?? 0)}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Withdrawal limit
            </p>
            <p className="mt-3 text-2xl font-black text-slate-950">
              {formatMoneyFromCents(profileData?.profile?.withdrawal_limit_cents ?? 0)}
            </p>
          </div>
        </section>

        {profileData?.profile?.rejection_reason && (
          <section className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
            Rejection reason: {profileData.profile.rejection_reason}
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <form
            onSubmit={saveProfile}
            className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
              Basic information
            </h2>

            <label className="mt-5 block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Full name
              </span>

              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Your full legal name"
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
              />
            </label>

            <label className="mt-4 block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Phone number
              </span>

              <input
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="+250..."
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
              />
            </label>

            <label className="mt-4 block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Country
              </span>

              <input
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                placeholder="Rwanda"
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              className="mt-6 w-full rounded-2xl bg-[#FF7A1A] px-5 py-4 text-sm font-black text-white shadow-sm transition hover:bg-[#E85F00] disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save profile"}
            </button>
          </form>

          <aside className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              Account
            </h2>

            <p className="mt-3 break-all text-sm font-semibold text-slate-500">
              Email: {profileData?.user?.email ?? "Not available"}
            </p>

            <p className="mt-3 break-all text-xs font-semibold text-slate-400">
              User ID: {profileData?.user?.id ?? "Not available"}
            </p>

            <div className="mt-5 grid gap-2">
              <Link
                href="/wallet"
                className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200"
              >
                Wallet
              </Link>

              <Link
                href="/ledger"
                className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200"
              >
                Ledger
              </Link>
            </div>
          </aside>
        </section>
      </div>
    </main>
  )
}