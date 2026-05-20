import { NextRequest, NextResponse } from "next/server"
import { getApiUser } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import {
  buildRateLimitKey,
  enforceRateLimit,
  getRequestIp,
} from "@/lib/rate-limit"

/**
 * /api/admin/money-requests
 *
 * GET:
 * - Admin sees money requests.
 *
 * POST:
 * - Admin approves/rejects a pending money request.
 *
 * Security:
 * - Requires logged-in admin.
 * - Wallet movement is done inside public.review_money_request().
 * - Admin action is written to admin_audit_logs.
 */

type Decision = "approved" | "rejected"

function isValidDecision(value: unknown): value is Decision {
  return value === "approved" || value === "rejected"
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

    if (errorResponse) {
      return errorResponse
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status") || "pending"

    let query = supabaseAdmin
      .from("money_requests")
      .select(`
        id,
        user_id,
        type,
        status,
        amount_cents,
        payment_method,
        payment_reference,
        account_name,
        account_number,
        user_note,
        reviewed_by,
        reviewed_at,
        admin_note,
        created_at,
        updated_at
      `)
      .order("created_at", { ascending: false })
      .limit(200)

    if (status !== "all") {
      query = query.eq("status", status)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json(
        { error: error.message, requests: [] },
        { status: 400 }
      )
    }

    return NextResponse.json({
      requests: data ?? [],
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error"

    return NextResponse.json(
      { error: message, requests: [] },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, errorResponse } = await requireAdmin(req)

    if (errorResponse) {
      return errorResponse
    }

    const ip = getRequestIp(req)

    const limited = enforceRateLimit({
      key: buildRateLimitKey(["admin-money-requests:post", user?.id, ip]),
      limit: 30,
      windowMs: 60_000,
    })

    if (limited) {
      return limited
    }

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please login first." },
        { status: 401 }
      )
    }

    const body = await req.json()

    const requestId = String(body.requestId || "")
    const decision = body.decision

    const adminNote =
      typeof body.adminNote === "string" ? body.adminNote.trim() : ""

    if (!requestId) {
      return NextResponse.json(
        { error: "requestId is required." },
        { status: 400 }
      )
    }

    if (!isValidDecision(decision)) {
      return NextResponse.json(
        { error: "decision must be approved or rejected." },
        { status: 400 }
      )
    }

    /**
     * Read request before review so audit log can include details.
     */
    const { data: requestBefore, error: requestBeforeError } =
      await supabaseAdmin
        .from("money_requests")
        .select("id, user_id, type, status, amount_cents")
        .eq("id", requestId)
        .maybeSingle()

    if (requestBeforeError) {
      return NextResponse.json(
        { error: requestBeforeError.message },
        { status: 400 }
      )
    }

    if (!requestBefore) {
      return NextResponse.json(
        { error: "Money request not found." },
        { status: 404 }
      )
    }

    const { data, error } = await supabaseAdmin.rpc("review_money_request", {
      p_admin_user_id: user.id,
      p_request_id: requestId,
      p_decision: decision,
      p_admin_note: adminNote || null,
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    const auditAction =
      requestBefore.type === "deposit"
        ? decision === "approved"
          ? "deposit_approved"
          : "deposit_rejected"
        : decision === "approved"
          ? "withdrawal_approved"
          : "withdrawal_rejected"

    /**
     * Write audit log.
     *
     * If audit logging fails, we do not undo the money request review.
     * But we return the audit error inside response for visibility.
     */
    const { error: auditError } = await supabaseAdmin.rpc(
      "write_admin_audit_log",
      {
        p_admin_user_id: user.id,
        p_action: auditAction,
        p_target_type: "money_request",
        p_target_id: requestId,
        p_summary: `${requestBefore.type} request ${decision}`,
        p_metadata: {
          requestId,
          userId: requestBefore.user_id,
          type: requestBefore.type,
          previousStatus: requestBefore.status,
          decision,
          amountCents: requestBefore.amount_cents,
          adminNote: adminNote || null,
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