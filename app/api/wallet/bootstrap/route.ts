import { NextRequest, NextResponse } from "next/server"
import { getApiUser } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * POST /api/wallet/bootstrap
 *
 * Creates a wallet for the logged-in user if it does not exist.
 *
 * This is useful after first login.
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

    const { error: ensureError } = await supabaseAdmin.rpc("ensure_wallet", {
      p_user_id: user.id,
    })

    if (ensureError) {
      return NextResponse.json(
        { error: ensureError.message },
        { status: 400 }
      )
    }

    const { data: wallet, error: walletError } = await supabaseAdmin
      .from("wallets")
      .select("user_id, available_cents, locked_cents, updated_at")
      .eq("user_id", user.id)
      .maybeSingle()

    if (walletError) {
      return NextResponse.json(
        { error: walletError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      wallet,
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