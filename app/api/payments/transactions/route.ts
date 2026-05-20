import { NextRequest, NextResponse } from "next/server"
import { getApiUser } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * GET /api/payments/transactions
 *
 * Logged-in user sees own payment transactions.
 */

export async function GET(req: NextRequest) {
  try {
    const user = await getApiUser(req)

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please login first.", transactions: [] },
        { status: 401 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from("payment_transactions")
      .select(`
        id,
        user_id,
        money_request_id,
        provider,
        type,
        status,
        amount_cents,
        currency,
        provider_reference,
        provider_transaction_id,
        checkout_url,
        failure_reason,
        credited_at,
        created_at,
        updated_at
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) {
      return NextResponse.json(
        { error: error.message, transactions: [] },
        { status: 400 }
      )
    }

    return NextResponse.json({
      transactions: data ?? [],
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error"

    return NextResponse.json(
      { error: message, transactions: [] },
      { status: 500 }
    )
  }
}