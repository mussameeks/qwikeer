import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { getApiUser } from "@/lib/api-auth"

/**
 * POST /api/admin/cancel-market
 *
 * Admin-only endpoint for safely cancelling a market.
 *
 * Audit:
 * - Writes market_cancelled into admin_audit_logs.
 */

export async function POST(req: NextRequest) {
  try {
    const adminUser = await getApiUser(req)

    if (!adminUser) {
      return NextResponse.json(
        { error: "Unauthorized. Please login first." },
        { status: 401 }
      )
    }

    const body = await req.json()

    const marketId = String(body.marketId || "")
    const cancelNote =
      typeof body.cancelNote === "string" ? body.cancelNote.trim() : null

    if (!marketId) {
      return NextResponse.json(
        { error: "marketId is required." },
        { status: 400 }
      )
    }

    const { data: marketBefore, error: marketBeforeError } = await supabaseAdmin
      .from("markets")
      .select("id, title, status, category")
      .eq("id", marketId)
      .maybeSingle()

    if (marketBeforeError) {
      return NextResponse.json(
        { error: marketBeforeError.message },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin.rpc("cancel_market", {
      p_admin_user_id: adminUser.id,
      p_market_id: marketId,
      p_cancel_note: cancelNote,
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
        p_action: "market_cancelled",
        p_target_type: "market",
        p_target_id: marketId,
        p_summary: "Cancelled market and processed safe refunds",
        p_metadata: {
          marketId,
          marketTitle: marketBefore?.title ?? null,
          previousStatus: marketBefore?.status ?? null,
          category: marketBefore?.category ?? null,
          cancelNote,
          result: data,
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