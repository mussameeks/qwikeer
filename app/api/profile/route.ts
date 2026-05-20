import { NextRequest, NextResponse } from "next/server"
import { getApiUser } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * /api/profile
 *
 * GET:
 * - Returns logged-in user's profile + wallet.
 *
 * PATCH:
 * - Updates basic user profile information.
 */

export async function GET(req: NextRequest) {
  try {
    const user = await getApiUser(req)

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please login first.", profile: null },
        { status: 401 }
      )
    }

    await supabaseAdmin.rpc("ensure_user_profile", {
      p_user_id: user.id,
      p_email: user.email ?? null,
    })

    await supabaseAdmin.rpc("ensure_wallet", {
      p_user_id: user.id,
    })

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select(`
        user_id,
        email,
        full_name,
        phone_number,
        country,
        verification_status,
        deposit_limit_cents,
        withdrawal_limit_cents,
        admin_note,
        rejection_reason,
        created_at,
        updated_at
      `)
      .eq("user_id", user.id)
      .maybeSingle()

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message, profile: null },
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
        { error: walletError.message, profile: null },
        { status: 400 }
      )
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
      },
      profile,
      wallet,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error"

    return NextResponse.json(
      { error: message, profile: null },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getApiUser(req)

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please login first." },
        { status: 401 }
      )
    }

    const body = await req.json()

    const fullName =
      typeof body.fullName === "string" ? body.fullName.trim() : ""

    const phoneNumber =
      typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : ""

    const country =
      typeof body.country === "string" && body.country.trim()
        ? body.country.trim()
        : "Rwanda"

    const { data, error } = await supabaseAdmin.rpc("update_own_profile", {
      p_user_id: user.id,
      p_full_name: fullName,
      p_phone_number: phoneNumber,
      p_country: country,
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