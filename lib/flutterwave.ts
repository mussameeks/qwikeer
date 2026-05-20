/**
 * Flutterwave helper functions for Qwikeer.
 *
 * Important:
 * - Never expose FLUTTERWAVE_SECRET_KEY to the browser.
 * - Always verify payment server-side before crediting wallet.
 */

type CreatePaymentInput = {
  txRef: string
  amount: number
  currency: string
  redirectUrl: string
  customer: {
    email: string
    name?: string
    phoneNumber?: string
  }
  meta?: Record<string, string | number | boolean | null>
}

type FlutterwaveCreatePaymentResponse = {
  status: string
  message: string
  data?: {
    link?: string
  }
}

type FlutterwaveVerifyResponse = {
  status: string
  message: string
  data?: {
    id?: number
    tx_ref?: string
    flw_ref?: string
    amount?: number
    currency?: string
    charged_amount?: number
    status?: string
    customer?: {
      email?: string
      name?: string
      phone_number?: string
    }
  }
}

function getFlutterwaveSecretKey() {
  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY

  if (!secretKey) {
    throw new Error("FLUTTERWAVE_SECRET_KEY is not configured.")
  }

  return secretKey
}

export function getFlutterwaveWebhookSecret() {
  return process.env.FLUTTERWAVE_WEBHOOK_SECRET || ""
}

export function centsToMajorUnits(amountCents: number) {
  return Number((amountCents / 100).toFixed(2))
}

export function majorUnitsToCents(amount: number) {
  return Math.round(Number(amount || 0) * 100)
}

export async function createFlutterwavePayment(input: CreatePaymentInput) {
  const secretKey = getFlutterwaveSecretKey()

  const response = await fetch("https://api.flutterwave.com/v3/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tx_ref: input.txRef,
      amount: input.amount,
      currency: input.currency,
      redirect_url: input.redirectUrl,
      payment_options: "card",
      customer: {
        email: input.customer.email,
        name: input.customer.name || input.customer.email,
        phonenumber: input.customer.phoneNumber || "",
      },
      customizations: {
        title: "Qwikeer Deposit",
        description: "Fund your Qwikeer wallet",
      },
      meta: input.meta || {},
    }),
  })

  const data = (await response.json()) as FlutterwaveCreatePaymentResponse

  if (!response.ok || data.status !== "success" || !data.data?.link) {
    throw new Error(data.message || "Could not initialize Flutterwave payment.")
  }

  return data
}

export async function verifyFlutterwaveTransaction(transactionId: string) {
  const secretKey = getFlutterwaveSecretKey()

  const response = await fetch(
    `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(
      transactionId
    )}/verify`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
    }
  )

  const data = (await response.json()) as FlutterwaveVerifyResponse

  if (!response.ok || data.status !== "success") {
    throw new Error(data.message || "Could not verify Flutterwave transaction.")
  }

  return data
}

export function isVerifiedFlutterwaveDeposit(input: {
  verifyResponse: FlutterwaveVerifyResponse
  expectedTxRef: string
  expectedAmountCents: number
  expectedCurrency: string
}) {
  const transaction = input.verifyResponse.data

  if (!transaction) return false

  const actualAmountCents = majorUnitsToCents(Number(transaction.amount || 0))

  return (
    transaction.status === "successful" &&
    transaction.tx_ref === input.expectedTxRef &&
    actualAmountCents === input.expectedAmountCents &&
    String(transaction.currency || "").toUpperCase() ===
      input.expectedCurrency.toUpperCase()
  )
}