import { NextRequest, NextResponse } from "next/server"
import { getApiUser } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * POST /api/money-requests/cancel
 *
 * User can cancel own pending deposit/withdrawal request.
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
    const requestId = String(body.requestId || "")

    if (!requestId) {
      return NextResponse.json(
        { error: "requestId is required." },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin.rpc("cancel_money_request", {
      p_user_id: user.id,
      p_request_id: requestId,
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