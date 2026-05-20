import { NextRequest, NextResponse } from "next/server"
import { getApiUser } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * GET /api/me
 *
 * Returns the currently logged-in user plus wallet/admin status.
 *
 * Security:
 * - User is verified from Supabase access token.
 * - We do not trust user_id from the frontend.
 */

export async function GET(req: NextRequest) {
  try {
    const user = await getApiUser(req)

    if (!user) {
      return NextResponse.json(
        {
          user: null,
          wallet: null,
          isAdmin: false,
          error: "Unauthorized. Please login first.",
        },
        { status: 401 }
      )
    }

    /**
     * Ensure wallet exists for this user.
     */
    const { error: ensureWalletError } = await supabaseAdmin.rpc("ensure_wallet", {
      p_user_id: user.id,
    })

    if (ensureWalletError) {
      return NextResponse.json(
        {
          user: {
            id: user.id,
            email: user.email,
          },
          wallet: null,
          isAdmin: false,
          error: ensureWalletError.message,
        },
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
        {
          user: {
            id: user.id,
            email: user.email,
          },
          wallet: null,
          isAdmin: false,
          error: walletError.message,
        },
        { status: 400 }
      )
    }

    const { data: adminRecord, error: adminError } = await supabaseAdmin
      .from("market_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle()

    if (adminError) {
      return NextResponse.json(
        {
          user: {
            id: user.id,
            email: user.email,
          },
          wallet,
          isAdmin: false,
          error: adminError.message,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
      },
      wallet,
      isAdmin: Boolean(adminRecord),
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error"

    return NextResponse.json(
      {
        user: null,
        wallet: null,
        isAdmin: false,
        error: message,
      },
      { status: 500 }
    )
  }
}