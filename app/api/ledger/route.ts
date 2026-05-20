import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { getApiUser } from "@/lib/api-auth"

/**
 * GET /api/ledger
 *
 * Returns logged-in user's ledger/audit history.
 *
 * Ledger entries show wallet movements such as:
 * - deposits
 * - order locks
 * - order unlocks
 * - trade debits/credits
 * - minting
 * - payouts
 * - refunds
 *
 * Security:
 * - User is verified from Supabase access token.
 * - We never accept user_id from query params.
 */

export async function GET(req: NextRequest) {
  try {
    const user = await getApiUser(req)

    if (!user) {
      return NextResponse.json(
        {
          error: "Unauthorized. Please login first.",
          entries: [],
        },
        { status: 401 }
      )
    }

    const { data: entries, error } = await supabaseAdmin
      .from("ledger_entries")
      .select(`
        id,
        user_id,
        type,
        amount_cents,
        balance_available_after,
        balance_locked_after,
        reference_id,
        note,
        created_at
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200)

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
          entries: [],
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      entries: entries ?? [],
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error"

    return NextResponse.json(
      {
        error: message,
        entries: [],
      },
      { status: 500 }
    )
  }
}