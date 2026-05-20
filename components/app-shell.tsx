"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ReactNode, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

/**
 * AppShell
 *
 * Main layout wrapper for Qwikeer:
 * - navigation
 * - auth status
 * - wallet quick view
 * - admin link
 */

type AppShellProps = {
  children: ReactNode
}

type NavItem = {
  href: string
  label: string
}

type MeResponse = {
  user: {
    id: string
    email?: string
  } | null
  wallet: {
    available_cents: number
    locked_cents: number
  } | null
  isAdmin: boolean
  error?: string
}
const navItems: NavItem[] = [
  {
    href: "/markets",
    label: "Markets",
  },
  {
    href: "/wallet",
    label: "Wallet",
  },
  {
    href: "/portfolio",
    label: "Portfolio",
  },
  {
    href: "/orders",
    label: "Orders",
  },
  {
    href: "/ledger",
    label: "Ledger",
  },
  {
    href: "/profile",
    label: "Profile",
  },
  {
    href: "/help",
    label: "Help",
  },
  {
    href: "/admin",
    label: "Admin",
  },
  {
    href: "/login",
    label: "Login",
  },
]
function formatMoneyFromCents(value: number) {
  return `${(Number(value || 0) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()

  const [me, setMe] = useState<MeResponse | null>(null)
  const [loadingMe, setLoadingMe] = useState(true)

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    return session?.access_token ?? null
  }

  async function loadMe() {
    try {
      setLoadingMe(true)

      const accessToken = await getAccessToken()

      if (!accessToken) {
        setMe(null)
        return
      }

      const res = await fetch("/api/me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      const contentType = res.headers.get("content-type") || ""

      if (!contentType.includes("application/json")) {
        setMe(null)
        return
      }

      const data: MeResponse = await res.json()

      if (!res.ok) {
        setMe(null)
        return
      }

      setMe(data)
    } catch {
      setMe(null)
    } finally {
      setLoadingMe(false)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setMe(null)
  }

  useEffect(() => {
    loadMe()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadMe()
    })

    return () => {
      subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="group flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white shadow-sm transition group-hover:bg-orange-600">
              Q
            </div>

            <div>
              <p className="text-lg font-black tracking-[-0.04em] text-slate-950">
                Qwikeer
              </p>
              <p className="-mt-1 text-xs font-semibold text-slate-500">
                Predict what happens next
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`)

              /**
               * Hide Admin nav if user is not admin.
               * Login remains visible for everyone.
               */
              if (item.href === "/admin" && !me?.isAdmin) {
                return null
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-2xl px-4 py-2 text-sm font-black transition ${
                    active
                      ? "bg-slate-950 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            {loadingMe ? (
              <div className="rounded-2xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-500">
                Checking session...
              </div>
            ) : me?.user ? (
              <>
                <Link
                  href="/portfolio"
                  className="rounded-2xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-200"
                >
                  Balance: {formatMoneyFromCents(me.wallet?.available_cents ?? 0)}
                </Link>

                <Link
                  href="/login"
                  className="max-w-[220px] truncate rounded-2xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-200"
                >
                  {me.user.email ?? "Account"}
                </Link>

                <button
                  type="button"
                  onClick={signOut}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-2xl bg-[#FF7A1A] px-5 py-3 text-sm font-black text-white transition hover:bg-[#E85F00]"
              >
                Login
              </Link>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100 px-4 py-2 md:hidden">
          <div className="flex gap-2 overflow-x-auto">
            {navItems.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`)

              if (item.href === "/admin" && !me?.isAdmin) {
                return null
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap rounded-2xl px-4 py-2 text-sm font-black transition ${
                    active
                      ? "bg-slate-950 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      </header>

      {children}
    </div>
  )
}