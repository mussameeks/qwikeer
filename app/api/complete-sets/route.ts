import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { getApiUser } from "@/lib/api-auth"

/**
 * POST /api/complete-sets
 *
 * Lets logged-in users mint complete YES/NO sets.
 *
 * Example:
 * - User mints 10 sets
 * - User pays 1000 cents
 * - User receives:
 *   - 10 YES shares
 *   - 10 NO shares
 *
 * This is required before a user can place SELL orders.
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

    const marketId = String(body.marketId || "")
    const quantity = Number(body.quantity)

    if (!marketId) {
      return NextResponse.json(
        { error: "marketId is required." },
        { status: 400 }
      )
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json(
        { error: "Quantity must be a positive integer." },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin.rpc("mint_complete_sets", {
      p_user_id: user.id,
      p_market_id: marketId,
      p_quantity: quantity,
    })

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

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}