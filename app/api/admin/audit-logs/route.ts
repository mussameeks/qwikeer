import { NextRequest, NextResponse } from "next/server"
import { getApiUser } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * GET /api/admin/audit-logs
 *
 * Admin-only route for viewing admin audit logs.
 *
 * Query params:
 * - action=all | market_created | deposit_approved | ...
 * - targetType=market | user | money_request | ...
 */

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

    if (errorResponse) {
      return errorResponse
    }

    const { searchParams } = new URL(req.url)

    const action = searchParams.get("action") || "all"
    const targetType = searchParams.get("targetType") || "all"

    let query = supabaseAdmin
      .from("admin_audit_logs")
      .select(`
        id,
        admin_user_id,
        action,
        target_type,
        target_id,
        summary,
        metadata,
        created_at
      `)
      .order("created_at", { ascending: false })
      .limit(300)

    if (action !== "all") {
      query = query.eq("action", action)
    }

    if (targetType !== "all") {
      query = query.eq("target_type", targetType)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json(
        { error: error.message, logs: [] },
        { status: 400 }
      )
    }

    return NextResponse.json({
      logs: data ?? [],
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error"

    return NextResponse.json(
      { error: message, logs: [] },
      { status: 500 }
    )
  }
}