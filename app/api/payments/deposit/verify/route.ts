import { NextRequest, NextResponse } from "next/server"
import { getApiUser } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import {
  isVerifiedFlutterwaveDeposit,
  verifyFlutterwaveTransaction,
} from "@/lib/flutterwave"

/**
 * POST /api/payments/deposit/verify
 *
 * User-facing verification after redirect.
 *
 * Body:
 * - txRef
 * - transactionId
 */

export async function POST(req: NextRequest) {
  try {
    const user = await getApiUser(req)

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please login first." },
        { status: 401 }
      )
    }

    const body = await req.json()

    const txRef = String(body.txRef || "")
    const transactionId = String(body.transactionId || "")

    if (!txRef) {
      return NextResponse.json(
        { error: "txRef is required." },
        { status: 400 }
      )
    }

    if (!transactionId) {
      return NextResponse.json(
        { error: "transactionId is required." },
        { status: 400 }
      )
    }

    const { data: paymentTransaction, error: paymentError } =
      await supabaseAdmin
        .from("payment_transactions")
        .select(
          "id, user_id, provider, provider_reference, amount_cents, currency, status"
        )
        .eq("provider", "flutterwave")
        .eq("provider_reference", txRef)
        .eq("user_id", user.id)
        .maybeSingle()

    if (paymentError) {
      return NextResponse.json(
        { error: paymentError.message },
        { status: 400 }
      )
    }

    if (!paymentTransaction) {
      return NextResponse.json(
        { error: "Payment transaction not found." },
        { status: 404 }
      )
    }

    const verifyResponse = await verifyFlutterwaveTransaction(transactionId)

    const verified = isVerifiedFlutterwaveDeposit({
      verifyResponse,
      expectedTxRef: paymentTransaction.provider_reference,
      expectedAmountCents: paymentTransaction.amount_cents,
      expectedCurrency: paymentTransaction.currency,
    })

    if (!verified) {
      await supabaseAdmin.rpc("mark_payment_transaction_failed", {
        p_payment_transaction_id: paymentTransaction.id,
        p_failure_reason: "Flutterwave verification failed",
        p_provider_verify_response: verifyResponse,
      })

      return NextResponse.json(
        { error: "Payment verification failed." },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin.rpc(
      "process_successful_payment_deposit",
      {
        p_provider: "flutterwave",
        p_provider_reference: txRef,
        p_provider_transaction_id: transactionId,
        p_provider_verify_response: verifyResponse,
      }
    )

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      result: data,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error"

    return NextResponse.json({ error: message }, { status: 500 })
  }
}