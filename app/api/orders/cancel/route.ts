import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { getApiUser } from "@/lib/api-auth"

/**
 * POST /api/orders/cancel
 *
 * Cancels an open or partially-filled order.
 *
 * The database RPC handles:
 * - verifying order ownership
 * - unlocking cash for buy orders
 * - unlocking shares for sell orders
 * - setting order status to cancelled
 */

export async function POST(req: NextRequest) {
  try {
    /**
     * Step 1:
     * Verify user.
     */
    const user = await getApiUser(req)

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please login first." },
        { status: 401 }
      )
    }

    /**
     * Step 2:
     * Read order ID.
     */
    const body = await req.json()
    const orderId = String(body.orderId || "")

    if (!orderId) {
      return NextResponse.json(
        { error: "orderId is required." },
        { status: 400 }
      )
    }

    /**
     * Step 3:
     * Call secure cancel RPC.
     */
    const { data, error } = await supabaseAdmin.rpc("cancel_order", {
      p_user_id: user.id,
      p_order_id: orderId,
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      order: data?.[0] ?? null,
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