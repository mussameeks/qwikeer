import { NextRequest, NextResponse } from "next/server"
import { getApiUser } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import {
  buildRateLimitKey,
  enforceRateLimit,
  getRequestIp,
} from "@/lib/rate-limit"
import {
  centsToMajorUnits,
  createFlutterwavePayment,
} from "@/lib/flutterwave"

/**
 * POST /api/payments/deposit/initiate
 *
 * Creates:
 * - money_request pending
 * - payment_transaction pending/processing
 * - Flutterwave checkout link
 *
 * Wallet is NOT credited here.
 * Wallet is credited only after verification.
 */

export async function POST(req: NextRequest) {
  try {
    const user = await getApiUser(req)

    const ip = getRequestIp(req)

    const limited = enforceRateLimit({
      key: buildRateLimitKey(["payments:deposit:initiate", user?.id, ip]),
      limit: 10,
      windowMs: 60_000,
    })

    if (limited) return limited

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please login first." },
        { status: 401 }
      )
    }

    const body = await req.json()

    const amountCents = Number(body.amountCents)
    const currency =
      typeof body.currency === "string" && body.currency.trim()
        ? body.currency.trim().toUpperCase()
        : "USD"

    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      return NextResponse.json(
        { error: "amountCents must be a positive integer." },
        { status: 400 }
      )
    }

    if (!["USD", "RWF"].includes(currency)) {
      return NextResponse.json(
        { error: "Unsupported currency. Use USD or RWF." },
        { status: 400 }
      )
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin

    const txRef = `qwikeer-${user.id}-${Date.now()}-${crypto.randomUUID()}`

    /**
     * Create a pending money request first.
     * This enforces profile completion, deposit limit, and account status.
     */
    const { data: moneyRequestResult, error: moneyRequestError } =
      await supabaseAdmin.rpc("create_money_request", {
        p_user_id: user.id,
        p_type: "deposit",
        p_amount_cents: amountCents,
        p_payment_method: "Flutterwave Card",
        p_payment_reference: txRef,
        p_account_name: null,
        p_account_number: null,
        p_user_note: "Card deposit initiated through Flutterwave",
      })

    if (moneyRequestError) {
      return NextResponse.json(
        { error: moneyRequestError.message },
        { status: 400 }
      )
    }

    const moneyRequestId = moneyRequestResult?.request_id

    const { data: paymentTransaction, error: paymentInsertError } =
      await supabaseAdmin
        .from("payment_transactions")
        .insert({
          user_id: user.id,
          money_request_id: moneyRequestId,
          provider: "flutterwave",
          type: "deposit",
          status: "pending",
          amount_cents: amountCents,
          currency,
          provider_reference: txRef,
        })
        .select("id, provider_reference")
        .single()

    if (paymentInsertError) {
      return NextResponse.json(
        { error: paymentInsertError.message },
        { status: 400 }
      )
    }

    try {
      const payment = await createFlutterwavePayment({
        txRef,
        amount: centsToMajorUnits(amountCents),
        currency,
        redirectUrl: `${siteUrl}/wallet?payment=flutterwave&tx_ref=${encodeURIComponent(
          txRef
        )}`,
        customer: {
          email: user.email || "customer@qwikeer.com",
          name: user.email || "Qwikeer User",
        },
        meta: {
          user_id: user.id,
          payment_transaction_id: paymentTransaction.id,
          money_request_id: moneyRequestId,
        },
      })

      await supabaseAdmin.rpc("mark_payment_transaction_processing", {
        p_payment_transaction_id: paymentTransaction.id,
        p_checkout_url: payment.data?.link || null,
        p_provider_init_response: payment,
      })

      return NextResponse.json({
        success: true,
        provider: "flutterwave",
        txRef,
        paymentTransactionId: paymentTransaction.id,
        moneyRequestId,
        checkoutUrl: payment.data?.link,
      })
    } catch (paymentError) {
      await supabaseAdmin.rpc("mark_payment_transaction_failed", {
        p_payment_transaction_id: paymentTransaction.id,
        p_failure_reason:
          paymentError instanceof Error
            ? paymentError.message
            : "Payment initialization failed",
        p_provider_verify_response: {},
      })

      return NextResponse.json(
        {
          error:
            paymentError instanceof Error
              ? paymentError.message
              : "Payment initialization failed",
        },
        { status: 400 }
      )
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error"

    return NextResponse.json({ error: message }, { status: 500 })
  }
}