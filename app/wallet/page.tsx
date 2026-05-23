"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Web3WalletCard } from "@/components/web3-wallet-card"

/**
 * Qwikeer Wallet Page
 *
 * User can:
 * - view wallet balance
 * - view verification status and limits
 * - connect/save Web3 embedded wallet
 * - create manual deposit/withdrawal request
 * - pay by card through Flutterwave
 * - verify Flutterwave payment after redirect
 * - view money request history
 * - view payment transaction history
 * - cancel pending manual request
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

type PaymentTransaction = {
  id: string
  user_id: string
  money_request_id?: string | null
  provider: string
  type: "deposit" | "withdrawal"
  status: "pending" | "processing" | "successful" | "failed" | "cancelled"
  amount_cents: number
  currency: string
  provider_reference: string
  provider_transaction_id?: string | null
  checkout_url?: string | null
  failure_reason?: string | null
  credited_at?: string | null
  created_at: string
  updated_at?: string | null
}

type RequestsResponse = {
  requests: MoneyRequest[]
  error?: string
}

type PaymentsResponse = {
  transactions: PaymentTransaction[]
  error?: string
}

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
    rejection_reason?: string | null
  } | null
  wallet: {
    user_id: string
    available_cents: number
    locked_cents: number
    updated_at?: string
  } | null
  error?: string
}

function formatMoneyFromCents(value: number, currency?: string) {
  const amount = (Number(value || 0) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return currency ? `${amount} ${currency}` : amount
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
  if (status === "pending" || status === "processing") {
    return "bg-amber-50 text-amber-700 ring-amber-200"
  }

  if (status === "approved" || status === "successful") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200"
  }

  if (status === "rejected" || status === "failed") {
    return "bg-red-50 text-red-700 ring-red-200"
  }

  return "bg-slate-100 text-slate-700 ring-slate-200"
}

function verificationClass(status: string) {
  if (status === "verified") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200"
  }

  if (status === "pending") {
    return "bg-amber-50 text-amber-700 ring-amber-200"
  }

  if (status === "rejected") {
    return "bg-red-50 text-red-700 ring-red-200"
  }

  if (status === "suspended") {
    return "bg-slate-950 text-white ring-slate-950"
  }

  return "bg-slate-100 text-slate-700 ring-slate-200"
}

function typeClass(type: string) {
  if (type === "deposit") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200"
  }

  return "bg-blue-50 text-blue-700 ring-blue-200"
}

export default function WalletPage() {
  const searchParams = useSearchParams()

  const [profileData, setProfileData] = useState<ProfileResponse | null>(null)
  const [requests, setRequests] = useState<MoneyRequest[]>([])
  const [paymentTransactions, setPaymentTransactions] = useState<
    PaymentTransaction[]
  >([])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [payingByCard, setPayingByCard] = useState(false)
  const [verifyingPayment, setVerifyingPayment] = useState(false)
  const [cancelingId, setCancelingId] = useState<string | null>(null)

  const [activeType, setActiveType] = useState<"deposit" | "withdrawal">(
    "deposit"
  )

  const [amountCents, setAmountCents] = useState("10000")
  const [cardCurrency, setCardCurrency] = useState("USD")
  const [paymentMethod, setPaymentMethod] = useState("MTN Mobile Money")
  const [paymentReference, setPaymentReference] = useState("")
  const [accountName, setAccountName] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [userNote, setUserNote] = useState("")

  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const verificationStatus =
    profileData?.profile?.verification_status ?? "unverified"

  const depositLimitCents = Number(
    profileData?.profile?.deposit_limit_cents ?? 0
  )

  const withdrawalLimitCents = Number(
    profileData?.profile?.withdrawal_limit_cents ?? 0
  )

  const canRequestDeposit = useMemo(() => {
    return (
      verificationStatus !== "unverified" &&
      verificationStatus !== "rejected" &&
      verificationStatus !== "suspended" &&
      depositLimitCents > 0
    )
  }, [verificationStatus, depositLimitCents])

  const canRequestWithdrawal = useMemo(() => {
    return verificationStatus === "verified" && withdrawalLimitCents > 0
  }, [verificationStatus, withdrawalLimitCents])

  const requestDisabled =
    activeType === "deposit" ? !canRequestDeposit : !canRequestWithdrawal

  const pendingRequestsCount = useMemo(() => {
    return requests.filter((request) => request.status === "pending").length
  }, [requests])

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    return session?.access_token ?? null
  }

  async function fetchProfile(accessToken: string) {
    const res = await fetch("/api/profile", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    const contentType = res.headers.get("content-type") || ""

    if (!contentType.includes("application/json")) {
      const text = await res.text()
      console.error("Non-JSON response from /api/profile:", text.slice(0, 500))
      throw new Error(
        `/api/profile returned non-JSON response. Status: ${res.status}`
      )
    }

    const data: ProfileResponse = await res.json()

    if (!res.ok) {
      throw new Error(data.error || "Could not load account profile.")
    }

    return data
  }

  async function fetchRequests(accessToken: string) {
    const res = await fetch("/api/money-requests", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    const contentType = res.headers.get("content-type") || ""

    if (!contentType.includes("application/json")) {
      const text = await res.text()
      console.error(
        "Non-JSON response from /api/money-requests:",
        text.slice(0, 500)
      )
      throw new Error(
        `/api/money-requests returned non-JSON response. Status: ${res.status}`
      )
    }

    const data: RequestsResponse = await res.json()

    if (!res.ok) {
      throw new Error(data.error || "Could not load money requests.")
    }

    return data.requests ?? []
  }

  async function fetchPaymentTransactions(accessToken: string) {
    const res = await fetch("/api/payments/transactions", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    const contentType = res.headers.get("content-type") || ""

    if (!contentType.includes("application/json")) {
      const text = await res.text()
      console.error(
        "Non-JSON response from /api/payments/transactions:",
        text.slice(0, 500)
      )
      throw new Error(
        `/api/payments/transactions returned non-JSON response. Status: ${res.status}`
      )
    }

    const data: PaymentsResponse = await res.json()

    if (!res.ok) {
      throw new Error(data.error || "Could not load payment transactions.")
    }

    return data.transactions ?? []
  }

  async function loadWallet(options?: { silent?: boolean }) {
    try {
      if (options?.silent) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError("")

      const accessToken = await getAccessToken()

      if (!accessToken) {
        setProfileData(null)
        setRequests([])
        setPaymentTransactions([])
        throw new Error("Please login first.")
      }

      const [profileResponse, requestsData, paymentData] = await Promise.all([
        fetchProfile(accessToken),
        fetchRequests(accessToken),
        fetchPaymentTransactions(accessToken),
      ])

      setProfileData(profileResponse)
      setRequests(requestsData)
      setPaymentTransactions(paymentData)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load wallet.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function verifyFlutterwaveRedirectPayment() {
    const payment = searchParams.get("payment")
    const txRef = searchParams.get("tx_ref")
    const transactionId =
      searchParams.get("transaction_id") || searchParams.get("transactionId")
    const status = searchParams.get("status")

    if (payment !== "flutterwave" || !txRef || !transactionId) {
      return
    }

    if (status && status !== "successful" && status !== "completed") {
      setError(`Payment was not successful. Status: ${status}`)
      return
    }

    try {
      setVerifyingPayment(true)
      setError("")
      setSuccess("")

      const accessToken = await getAccessToken()

      if (!accessToken) {
        throw new Error("Please login first.")
      }

      const res = await fetch("/api/payments/deposit/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          txRef,
          transactionId,
        }),
      })

      const contentType = res.headers.get("content-type") || ""

      if (!contentType.includes("application/json")) {
        const text = await res.text()
        console.error(
          "Non-JSON response from /api/payments/deposit/verify:",
          text.slice(0, 500)
        )
        throw new Error(
          `/api/payments/deposit/verify returned non-JSON response. Status: ${res.status}`
        )
      }

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Payment verification failed.")
      }

      setSuccess("Card payment verified and wallet credited successfully.")

      await loadWallet({ silent: true })

      window.history.replaceState({}, "", "/wallet")
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Payment verification failed."
      )
    } finally {
      setVerifyingPayment(false)
    }
  }

  async function createManualRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setSubmitting(true)
      setError("")
      setSuccess("")

      const accessToken = await getAccessToken()

      if (!accessToken) {
        throw new Error("Please login first.")
      }

      if (requestDisabled) {
        if (activeType === "deposit") {
          throw new Error(
            "Deposits are not enabled. Complete your profile and wait for admin limits."
          )
        }

        throw new Error(
          "Withdrawals require a verified account and withdrawal limit."
        )
      }

      const amount = Number(amountCents)

      if (!Number.isInteger(amount) || amount <= 0) {
        throw new Error("Amount must be a positive number of cents.")
      }

      if (activeType === "deposit" && amount > depositLimitCents) {
        throw new Error("Amount exceeds your deposit limit.")
      }

      if (activeType === "withdrawal" && amount > withdrawalLimitCents) {
        throw new Error("Amount exceeds your withdrawal limit.")
      }

      if (activeType === "deposit" && !paymentMethod.trim()) {
        throw new Error("Payment method is required for deposit requests.")
      }

      if (
        activeType === "withdrawal" &&
        (!accountName.trim() || !accountNumber.trim())
      ) {
        throw new Error("Account name and account number are required.")
      }

      const res = await fetch("/api/money-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          type: activeType,
          amountCents: amount,
          paymentMethod,
          paymentReference,
          accountName,
          accountNumber,
          userNote,
        }),
      })

      const contentType = res.headers.get("content-type") || ""

      if (!contentType.includes("application/json")) {
        const text = await res.text()
        console.error(
          "Non-JSON response from POST /api/money-requests:",
          text.slice(0, 500)
        )
        throw new Error(
          `POST /api/money-requests returned non-JSON response. Status: ${res.status}`
        )
      }

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Could not create request.")
      }

      setSuccess(
        `${
          activeType === "deposit" ? "Deposit" : "Withdrawal"
        } request created successfully.`
      )

      setPaymentReference("")
      setUserNote("")

      await loadWallet({ silent: true })
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not create request."
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function payByCard() {
    try {
      setPayingByCard(true)
      setError("")
      setSuccess("")

      const accessToken = await getAccessToken()

      if (!accessToken) {
        throw new Error("Please login first.")
      }

      if (!canRequestDeposit) {
        throw new Error(
          "Card deposits require a completed profile and an admin deposit limit."
        )
      }

      const amount = Number(amountCents)

      if (!Number.isInteger(amount) || amount <= 0) {
        throw new Error("Amount must be a positive number of cents.")
      }

      if (amount > depositLimitCents) {
        throw new Error("Amount exceeds your deposit limit.")
      }

      const res = await fetch("/api/payments/deposit/initiate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          amountCents: amount,
          currency: cardCurrency,
        }),
      })

      const contentType = res.headers.get("content-type") || ""

      if (!contentType.includes("application/json")) {
        const text = await res.text()
        console.error(
          "Non-JSON response from /api/payments/deposit/initiate:",
          text.slice(0, 500)
        )
        throw new Error(
          `/api/payments/deposit/initiate returned non-JSON response. Status: ${res.status}`
        )
      }

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Could not start card payment.")
      }

      if (!data.checkoutUrl) {
        throw new Error("Checkout URL was not returned.")
      }

      window.location.href = data.checkoutUrl
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not start payment."
      )
      setPayingByCard(false)
    }
  }

  async function cancelRequest(requestId: string) {
    try {
      setCancelingId(requestId)
      setError("")
      setSuccess("")

      const accessToken = await getAccessToken()

      if (!accessToken) {
        throw new Error("Please login first.")
      }

      const res = await fetch("/api/money-requests/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          requestId,
        }),
      })

      const contentType = res.headers.get("content-type") || ""

      if (!contentType.includes("application/json")) {
        const text = await res.text()
        console.error(
          "Non-JSON response from /api/money-requests/cancel:",
          text.slice(0, 500)
        )
        throw new Error(
          `/api/money-requests/cancel returned non-JSON response. Status: ${res.status}`
        )
      }

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Could not cancel request.")
      }

      setSuccess("Request cancelled successfully.")
      await loadWallet({ silent: true })
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not cancel request."
      )
    } finally {
      setCancelingId(null)
    }
  }

  useEffect(() => {
    loadWallet()
  }, [])

  useEffect(() => {
    verifyFlutterwaveRedirectPayment()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  if (loading) {
    return (
      <main className="p-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">
            Loading wallet...
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
                Qwikeer Wallet
              </p>

              <h1 className="mt-2 text-4xl font-black tracking-[-0.06em] text-slate-950 md:text-6xl">
                Deposits & withdrawals.
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Request manual deposits/withdrawals, fund your wallet by card,
                and connect your Web3 wallet for future on-chain Qwikeer
                markets.
              </p>

              {profileData?.user?.email && (
                <p className="mt-3 text-xs font-bold text-slate-400">
                  Logged in as {profileData.user.email}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => loadWallet({ silent: true })}
                disabled={refreshing}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>

              <Link
                href="/profile"
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Profile
              </Link>

              <Link
                href="/portfolio"
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
              >
                Portfolio
              </Link>
            </div>
          </div>
        </section>

        {verifyingPayment && (
          <section className="rounded-3xl border border-blue-200 bg-blue-50 p-5 text-sm font-semibold text-blue-700">
            Verifying card payment. Please do not close this page.
          </section>
        )}

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

        {verificationStatus === "unverified" && (
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold leading-6 text-amber-800">
            Complete your profile before creating deposit or withdrawal
            requests.{" "}
            <Link href="/profile" className="underline">
              Go to Profile
            </Link>
          </section>
        )}

        {verificationStatus === "rejected" && (
          <section className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold leading-6 text-red-700">
            Your verification was rejected. Reason:{" "}
            {profileData?.profile?.rejection_reason || "Not provided."}
          </section>
        )}

        {verificationStatus === "suspended" && (
          <section className="rounded-3xl border border-slate-300 bg-slate-950 p-5 text-sm font-semibold leading-6 text-white">
            Your account is suspended. Contact support before using wallet
            services.
          </section>
        )}

        <Web3WalletCard />

        <section className="grid gap-4 md:grid-cols-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Verification
            </p>
            <span
              className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-black capitalize ring-1 ${verificationClass(
                verificationStatus
              )}`}
            >
              {verificationStatus}
            </span>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Available
            </p>
            <p className="mt-3 text-2xl font-black tracking-[-0.05em] text-slate-950">
              {formatMoneyFromCents(profileData?.wallet?.available_cents ?? 0)}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Locked
            </p>
            <p className="mt-3 text-2xl font-black tracking-[-0.05em] text-slate-950">
              {formatMoneyFromCents(profileData?.wallet?.locked_cents ?? 0)}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Deposit limit
            </p>
            <p className="mt-3 text-2xl font-black tracking-[-0.05em] text-emerald-700">
              {formatMoneyFromCents(depositLimitCents)}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Withdrawal limit
            </p>
            <p className="mt-3 text-2xl font-black tracking-[-0.05em] text-blue-700">
              {formatMoneyFromCents(withdrawalLimitCents)}
            </p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <div className="space-y-6">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
                Pay by card
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                Card payments are processed through Flutterwave. Your wallet is
                credited only after Qwikeer verifies the transaction server-side.
              </p>

              {!canRequestDeposit && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold leading-5 text-amber-800">
                  Card deposits require a completed profile and an admin deposit
                  limit.
                </div>
              )}

              <label className="mt-5 block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Amount in cents
                </span>

                <input
                  value={amountCents}
                  onChange={(event) => setAmountCents(event.target.value)}
                  inputMode="numeric"
                  placeholder="10000"
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Preview:{" "}
                  {formatMoneyFromCents(
                    Number(amountCents || 0),
                    cardCurrency
                  )}
                </p>
              </label>

              <label className="mt-4 block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Currency
                </span>

                <select
                  value={cardCurrency}
                  onChange={(event) => setCardCurrency(event.target.value)}
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                >
                  <option value="USD">USD</option>
                  <option value="RWF">RWF</option>
                </select>
              </label>

              <button
                type="button"
                onClick={payByCard}
                disabled={payingByCard || !canRequestDeposit}
                className="mt-6 w-full rounded-2xl bg-[#FF7A1A] px-5 py-4 text-sm font-black text-white shadow-sm transition hover:bg-[#E85F00] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {payingByCard ? "Opening checkout..." : "Pay by Card"}
              </button>
            </section>

            <form
              onSubmit={createManualRequest}
              className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
                Manual request
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Manual deposit or withdrawal request for admin review.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2">
                {(["deposit", "withdrawal"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setActiveType(type)}
                    className={`rounded-2xl px-4 py-3 text-sm font-black capitalize transition ${
                      activeType === type
                        ? "bg-slate-950 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {requestDisabled && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold leading-5 text-amber-800">
                  {activeType === "deposit"
                    ? "Deposits require a completed profile and an admin deposit limit."
                    : "Withdrawals require verified status and an admin withdrawal limit."}
                </div>
              )}

              <label className="mt-5 block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Amount in cents
                </span>

                <input
                  value={amountCents}
                  onChange={(event) => setAmountCents(event.target.value)}
                  inputMode="numeric"
                  placeholder="10000"
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Preview: {formatMoneyFromCents(Number(amountCents || 0))}
                </p>
              </label>

              {activeType === "deposit" && (
                <>
                  <label className="mt-4 block">
                    <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Payment method
                    </span>

                    <select
                      value={paymentMethod}
                      onChange={(event) => setPaymentMethod(event.target.value)}
                      className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                    >
                      <option value="MTN Mobile Money">MTN Mobile Money</option>
                      <option value="Airtel Money">Airtel Money</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cash Deposit">Cash Deposit</option>
                    </select>
                  </label>

                  <label className="mt-4 block">
                    <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Payment reference
                    </span>

                    <input
                      value={paymentReference}
                      onChange={(event) =>
                        setPaymentReference(event.target.value)
                      }
                      placeholder="Transaction ID or payment proof reference"
                      className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                    />
                  </label>
                </>
              )}

              {activeType === "withdrawal" && (
                <>
                  <label className="mt-4 block">
                    <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Account name
                    </span>

                    <input
                      value={accountName}
                      onChange={(event) => setAccountName(event.target.value)}
                      placeholder="Name on Mobile Money or bank account"
                      className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                    />
                  </label>

                  <label className="mt-4 block">
                    <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Account number
                    </span>

                    <input
                      value={accountNumber}
                      onChange={(event) => setAccountNumber(event.target.value)}
                      placeholder="Phone number or bank account number"
                      className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                    />
                  </label>
                </>
              )}

              <label className="mt-4 block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Note
                </span>

                <textarea
                  value={userNote}
                  onChange={(event) => setUserNote(event.target.value)}
                  placeholder="Optional note for admin"
                  rows={4}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />
              </label>

              <button
                type="submit"
                disabled={submitting || requestDisabled}
                className="mt-6 w-full rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting
                  ? "Submitting..."
                  : `Submit manual ${activeType} request`}
              </button>
            </form>
          </div>

          <div className="space-y-6">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
                    Request history
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {pendingRequestsCount} pending request
                    {pendingRequestsCount === 1 ? "" : "s"}.
                  </p>
                </div>

                <Link
                  href="/ledger"
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                >
                  View ledger
                </Link>
              </div>

              {requests.length === 0 ? (
                <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                  <p className="text-sm font-black text-slate-700">
                    No requests yet.
                  </p>

                  <p className="mt-2 text-sm text-slate-500">
                    Manual deposit and withdrawal requests will appear here.
                  </p>
                </div>
              ) : (
                <div className="mt-6 space-y-3">
                  {requests.map((request) => {
                    const canCancel = request.status === "pending"

                    return (
                      <div
                        key={request.id}
                        className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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

                            <p className="mt-1 text-xs font-semibold text-slate-400">
                              Created {formatDateTime(request.created_at)}
                            </p>

                            {request.payment_method && (
                              <p className="mt-3 text-sm font-semibold text-slate-600">
                                Method: {request.payment_method}
                              </p>
                            )}

                            {request.payment_reference && (
                              <p className="mt-1 break-all text-sm font-semibold text-slate-600">
                                Reference: {request.payment_reference}
                              </p>
                            )}

                            {request.account_name && (
                              <p className="mt-3 text-sm font-semibold text-slate-600">
                                Account name: {request.account_name}
                              </p>
                            )}

                            {request.account_number && (
                              <p className="mt-1 text-sm font-semibold text-slate-600">
                                Account number: {request.account_number}
                              </p>
                            )}

                            {request.user_note && (
                              <p className="mt-3 text-sm leading-6 text-slate-500">
                                User note: {request.user_note}
                              </p>
                            )}

                            {request.admin_note && (
                              <p className="mt-3 text-sm leading-6 text-slate-500">
                                Admin note: {request.admin_note}
                              </p>
                            )}

                            {request.reviewed_at && (
                              <p className="mt-2 text-xs font-semibold text-slate-400">
                                Reviewed {formatDateTime(request.reviewed_at)}
                              </p>
                            )}
                          </div>

                          {canCancel && (
                            <button
                              type="button"
                              disabled={cancelingId === request.id}
                              onClick={() => cancelRequest(request.id)}
                              className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {cancelingId === request.id
                                ? "Cancelling..."
                                : "Cancel"}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
                Card payment history
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Flutterwave/card payment transactions linked to your wallet.
              </p>

              {paymentTransactions.length === 0 ? (
                <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                  <p className="text-sm font-black text-slate-700">
                    No card payments yet.
                  </p>

                  <p className="mt-2 text-sm text-slate-500">
                    Successful verified card deposits will appear here.
                  </p>
                </div>
              ) : (
                <div className="mt-6 space-y-3">
                  {paymentTransactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">
                              {transaction.provider}
                            </span>

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-black capitalize ring-1 ${statusClass(
                                transaction.status
                              )}`}
                            >
                              {transaction.status}
                            </span>

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-black capitalize ring-1 ${typeClass(
                                transaction.type
                              )}`}
                            >
                              {transaction.type}
                            </span>
                          </div>

                          <p className="mt-3 text-2xl font-black tracking-[-0.04em] text-slate-950">
                            {formatMoneyFromCents(
                              transaction.amount_cents,
                              transaction.currency
                            )}
                          </p>

                          <p className="mt-1 text-xs font-semibold text-slate-400">
                            Created {formatDateTime(transaction.created_at)}
                          </p>

                          <p className="mt-3 break-all text-xs font-semibold text-slate-500">
                            Ref: {transaction.provider_reference}
                          </p>

                          {transaction.provider_transaction_id && (
                            <p className="mt-1 break-all text-xs font-semibold text-slate-500">
                              Transaction ID:{" "}
                              {transaction.provider_transaction_id}
                            </p>
                          )}

                          {transaction.credited_at && (
                            <p className="mt-2 text-xs font-semibold text-emerald-700">
                              Credited {formatDateTime(transaction.credited_at)}
                            </p>
                          )}

                          {transaction.failure_reason && (
                            <p className="mt-2 text-sm font-semibold text-red-700">
                              Failure: {transaction.failure_reason}
                            </p>
                          )}
                        </div>

                        {transaction.status === "processing" &&
                          transaction.checkout_url && (
                            <a
                              href={transaction.checkout_url}
                              className="rounded-2xl bg-[#FF7A1A] px-5 py-3 text-center text-sm font-black text-white transition hover:bg-[#E85F00]"
                            >
                              Continue payment
                            </a>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
    </main>
  )
}