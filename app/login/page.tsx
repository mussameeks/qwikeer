"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

/**
 * Qwikeer Login Page
 *
 * Handles:
 * - email magic-link login
 * - session display
 * - wallet bootstrap after login
 * - logout
 */

type MeResponse = {
  user: {
    id: string
    email?: string
  } | null
  wallet: {
    user_id: string
    available_cents: number
    locked_cents: number
  } | null
  isAdmin: boolean
  error?: string
}

function formatMoneyFromCents(value: number) {
  return `${(Number(value || 0) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [me, setMe] = useState<MeResponse | null>(null)

  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    return session?.access_token ?? null
  }

  /**
   * Bootstrap wallet after login.
   */
  async function bootstrapWallet(accessToken: string) {
    const res = await fetch("/api/wallet/bootstrap", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    const contentType = res.headers.get("content-type") || ""

    if (!contentType.includes("application/json")) {
      const text = await res.text()
      console.error("Non-JSON response from /api/wallet/bootstrap:", text.slice(0, 500))
      throw new Error(`/api/wallet/bootstrap returned non-JSON response. Status: ${res.status}`)
    }

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || "Could not bootstrap wallet.")
    }

    return data
  }

  /**
   * Load current logged-in user profile.
   */
  async function loadMe() {
    try {
      setCheckingSession(true)
      setError("")

      const accessToken = await getAccessToken()

      if (!accessToken) {
        setMe(null)
        return
      }

      await bootstrapWallet(accessToken)

      const res = await fetch("/api/me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      const contentType = res.headers.get("content-type") || ""

      if (!contentType.includes("application/json")) {
        const text = await res.text()
        console.error("Non-JSON response from /api/me:", text.slice(0, 500))
        throw new Error(`/api/me returned non-JSON response. Status: ${res.status}`)
      }

      const data: MeResponse = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Could not load user session.")
      }

      setMe(data)
    } catch (error) {
      setMe(null)
      setError(error instanceof Error ? error.message : "Could not load session.")
    } finally {
      setCheckingSession(false)
    }
  }

  /**
   * Send Supabase email magic link.
   */
  async function sendMagicLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setLoading(true)
      setMessage("")
      setError("")

      if (!email.trim()) {
        throw new Error("Please enter your email.")
      }

      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/login`
          : undefined

      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: redirectTo,
        },
      })

      if (error) {
        throw error
      }

      setMessage("Check your email and click the Qwikeer login link.")
      setEmail("")
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not send login link."
      )
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    setMe(null)
    setMessage("You have logged out successfully.")
    router.refresh()
  }

  useEffect(() => {
    loadMe()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async () => {
      await loadMe()
    })

    return () => {
      subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (checkingSession) {
    return (
      <main className="p-6">
        <section className="mx-auto max-w-xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">
            Checking Qwikeer session...
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="p-6">
      <section className="mx-auto max-w-xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-600">
          Qwikeer Login
        </p>

        <h1 className="mt-3 text-4xl font-black tracking-[-0.06em] text-slate-950">
          Login to Qwikeer
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-500">
          Use your email to receive a secure magic login link.
        </p>

        {message && (
          <div className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
            {message}
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {me?.user ? (
          <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-700">
            <p className="text-sm font-black">You are logged in as:</p>

            <p className="mt-1 text-sm font-semibold">
              {me.user.email ?? "No email"}
            </p>

            <p className="mt-3 break-all text-xs font-semibold text-emerald-700/80">
              User ID: {me.user.id}
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white p-4 ring-1 ring-emerald-200">
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                  Available
                </p>
                <p className="mt-1 text-xl font-black">
                  {formatMoneyFromCents(me.wallet?.available_cents ?? 0)}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-4 ring-1 ring-emerald-200">
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                  Locked
                </p>
                <p className="mt-1 text-xl font-black">
                  {formatMoneyFromCents(me.wallet?.locked_cents ?? 0)}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/markets"
                className="rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white"
              >
                Browse markets
              </Link>

              <Link
                href="/portfolio"
                className="rounded-2xl border border-emerald-200 bg-white px-5 py-3 text-sm font-black text-emerald-700"
              >
                Portfolio
              </Link>

              {me.isAdmin && (
                <Link
                  href="/admin"
                  className="rounded-2xl border border-emerald-200 bg-white px-5 py-3 text-sm font-black text-emerald-700"
                >
                  Admin
                </Link>
              )}

              <button
                type="button"
                onClick={logout}
                className="rounded-2xl border border-red-200 bg-white px-5 py-3 text-sm font-black text-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={sendMagicLink} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Email address
              </span>

              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-[#FF7A1A] px-5 py-4 text-sm font-black text-white shadow-sm transition hover:bg-[#E85F00] disabled:opacity-60"
            >
              {loading ? "Sending login link..." : "Send login link"}
            </button>
          </form>
        )}
      </section>
    </main>
  )
}