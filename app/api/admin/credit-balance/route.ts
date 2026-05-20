import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { getApiUser } from "@/lib/api-auth"
import {
  buildRateLimitKey,
  enforceRateLimit,
  getRequestIp,
} from "@/lib/rate-limit"

/**
 * POST /api/admin/credit-balance
 *
 * DEV-ONLY admin endpoint for crediting demo/testing balance.
 *
 * Audit:
 * - Writes demo_balance_credited into admin_audit_logs.
 */

function devToolsEnabled() {
  return process.env.QWIKEER_DEV_TOOLS_ENABLED === "true"
}

export async function POST(req: NextRequest) {
  try {
    if (!devToolsEnabled()) {
      return NextResponse.json(
        {
          error:
            "Development tools are disabled. Demo balance credit is not available.",
        },
        { status: 403 }
      )
    }

    const adminUser = await getApiUser(req)

    const ip = getRequestIp(req)

    const limited = enforceRateLimit({
      key: buildRateLimitKey(["admin-credit-balance:post", adminUser?.id, ip]),
      limit: 10,
      windowMs: 60_000,
    })

    if (limited) {
      return limited
    }

    if (!adminUser) {
      return NextResponse.json(
        { error: "Unauthorized. Please login first." },
        { status: 401 }
      )
    }

    const body = await req.json()

    const targetUserId = String(body.targetUserId || "")
    const amountCents = Number(body.amountCents)

    if (!targetUserId) {
      return NextResponse.json(
        { error: "targetUserId is required." },
        { status: 400 }
      )
    }

    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      return NextResponse.json(
        { error: "amountCents must be a positive integer." },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin.rpc("credit_demo_balance", {
      p_admin_user_id: adminUser.id,
      p_target_user_id: targetUserId,
      p_amount_cents: amountCents,
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    const { error: auditError } = await supabaseAdmin.rpc(
      "write_admin_audit_log",
      {
        p_admin_user_id: adminUser.id,
        p_action: "demo_balance_credited",
        p_target_type: "user",
        p_target_id: targetUserId,
        p_summary: `Credited demo balance to user`,
        p_metadata: {
          targetUserId,
          amountCents,
          result: data,
          devTool: true,
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