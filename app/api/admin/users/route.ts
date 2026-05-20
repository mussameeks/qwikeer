import { NextRequest, NextResponse } from "next/server"
import { getApiUser } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * /api/admin/users
 *
 * GET:
 * - Admin lists user profiles.
 *
 * PATCH:
 * - Admin updates verification status and limits.
 *
 * Audit:
 * - Writes user_profile_updated into admin_audit_logs.
 */

type VerificationStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "rejected"
  | "suspended"

function isValidVerificationStatus(value: unknown): value is VerificationStatus {
  return (
    value === "unverified" ||
    value === "pending" ||
    value === "verified" ||
    value === "rejected" ||
    value === "suspended"
  )
}

async function requireAdmin(req: NextRequest) {
  const user = await getApiUser(req)

  if (!user) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: "Unauthorized. Please login first." },
        { status: 401 }
      ),
    }
  }

  const { data: adminRecord, error: adminError } = await supabaseAdmin
    .from("market_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (adminError) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: adminError.message },
        { status: 400 }
      ),
    }
  }

  if (!adminRecord) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: "Access denied. This account is not an admin." },
        { status: 403 }
      ),
    }
  }

  return {
    user,
    errorResponse: null,
  }
}

export async function GET(req: NextRequest) {
  try {
    const { errorResponse } = await requireAdmin(req)

    if (errorResponse) return errorResponse

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status") || "all"
    const search = searchParams.get("search") || ""

    let query = supabaseAdmin
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
      .order("created_at", { ascending: false })
      .limit(200)

    if (status !== "all") {
      query = query.eq("verification_status", status)
    }

    if (search.trim()) {
      const value = search.trim()
      query = query.or(
        `email.ilike.%${value}%,full_name.ilike.%${value}%,phone_number.ilike.%${value}%`
      )
    }

    const { data: profiles, error } = await query

    if (error) {
      return NextResponse.json(
        { error: error.message, profiles: [] },
        { status: 400 }
      )
    }

    const userIds = (profiles ?? []).map((profile) => profile.user_id)

    let wallets: any[] = []

    if (userIds.length > 0) {
      const { data: walletData, error: walletError } = await supabaseAdmin
        .from("wallets")
        .select("user_id, available_cents, locked_cents, updated_at")
        .in("user_id", userIds)

      if (walletError) {
        return NextResponse.json(
          { error: walletError.message, profiles: [] },
          { status: 400 }
        )
      }

      wallets = walletData ?? []
    }

    const enrichedProfiles = (profiles ?? []).map((profile) => ({
      ...profile,
      wallet:
        wallets.find((wallet) => wallet.user_id === profile.user_id) ?? null,
    }))

    return NextResponse.json({
      profiles: enrichedProfiles,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error"

    return NextResponse.json(
      { error: message, profiles: [] },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { user, errorResponse } = await requireAdmin(req)

    if (errorResponse) return errorResponse

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please login first." },
        { status: 401 }
      )
    }

    const body = await req.json()

    const targetUserId = String(body.targetUserId || "")
    const verificationStatus = body.verificationStatus
    const depositLimitCents = Number(body.depositLimitCents)
    const withdrawalLimitCents = Number(body.withdrawalLimitCents)

    const adminNote =
      typeof body.adminNote === "string" ? body.adminNote.trim() : ""

    const rejectionReason =
      typeof body.rejectionReason === "string"
        ? body.rejectionReason.trim()
        : ""

    if (!targetUserId) {
      return NextResponse.json(
        { error: "targetUserId is required." },
        { status: 400 }
      )
    }

    if (!isValidVerificationStatus(verificationStatus)) {
      return NextResponse.json(
        { error: "Invalid verification status." },
        { status: 400 }
      )
    }

    if (
      !Number.isInteger(depositLimitCents) ||
      depositLimitCents < 0 ||
      !Number.isInteger(withdrawalLimitCents) ||
      withdrawalLimitCents < 0
    ) {
      return NextResponse.json(
        { error: "Limits must be positive integer cents." },
        { status: 400 }
      )
    }

    /**
     * Read profile before update for audit diff.
     */
    const { data: profileBefore } = await supabaseAdmin
      .from("user_profiles")
      .select(`
        user_id,
        email,
        full_name,
        verification_status,
        deposit_limit_cents,
        withdrawal_limit_cents
      `)
      .eq("user_id", targetUserId)
      .maybeSingle()

    const { data, error } = await supabaseAdmin.rpc(
      "admin_update_user_profile",
      {
        p_admin_user_id: user.id,
        p_target_user_id: targetUserId,
        p_verification_status: verificationStatus,
        p_deposit_limit_cents: depositLimitCents,
        p_withdrawal_limit_cents: withdrawalLimitCents,
        p_admin_note: adminNote || null,
        p_rejection_reason: rejectionReason || null,
      }
    )

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    const { error: auditError } = await supabaseAdmin.rpc(
      "write_admin_audit_log",
      {
        p_admin_user_id: user.id,
        p_action: "user_profile_updated",
        p_target_type: "user",
        p_target_id: targetUserId,
        p_summary: "Updated user verification status and limits",
        p_metadata: {
          targetUserId,
          email: profileBefore?.email ?? null,
          fullName: profileBefore?.full_name ?? null,
          before: {
            verificationStatus: profileBefore?.verification_status ?? null,
            depositLimitCents: profileBefore?.deposit_limit_cents ?? null,
            withdrawalLimitCents:
              profileBefore?.withdrawal_limit_cents ?? null,
          },
          after: {
            verificationStatus,
            depositLimitCents,
            withdrawalLimitCents,
          },
          adminNote: adminNote || null,
          rejectionReason: rejectionReason || null,
        },
      }
    )

    return NextResponse.json({
      success: true,
      result: data,
      auditWarning: auditError?.message ?? null,
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