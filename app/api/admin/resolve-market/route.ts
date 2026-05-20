import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { getApiUser } from "@/lib/api-auth"

/**
 * POST /api/admin/resolve-market
 *
 * Admin-only endpoint for resolving a Qwikeer market.
 *
 * Audit:
 * - Writes market_resolved into admin_audit_logs.
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
    const winningOutcomeId = String(body.winningOutcomeId || "")
    const resolutionNote =
      typeof body.resolutionNote === "string"
        ? body.resolutionNote.trim()
        : null

    if (!marketId) {
      return NextResponse.json(
        { error: "marketId is required." },
        { status: 400 }
      )
    }

    if (!winningOutcomeId) {
      return NextResponse.json(
        { error: "winningOutcomeId is required." },
        { status: 400 }
      )
    }

    /**
     * Read market/outcome before resolution for audit metadata.
     */
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

    const { data: winningOutcome, error: outcomeError } = await supabaseAdmin
      .from("outcomes")
      .select("id, market_id, code, name")
      .eq("id", winningOutcomeId)
      .eq("market_id", marketId)
      .maybeSingle()

    if (outcomeError) {
      return NextResponse.json(
        { error: outcomeError.message },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin.rpc("resolve_market", {
      p_admin_user_id: adminUser.id,
      p_market_id: marketId,
      p_winning_outcome_id: winningOutcomeId,
      p_resolution_note: resolutionNote,
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    /**
     * Audit log.
     */
    const { error: auditError } = await supabaseAdmin.rpc(
      "write_admin_audit_log",
      {
        p_admin_user_id: adminUser.id,
        p_action: "market_resolved",
        p_target_type: "market",
        p_target_id: marketId,
        p_summary: `Resolved market as ${winningOutcome?.code ?? "selected outcome"}`,
        p_metadata: {
          marketId,
          marketTitle: marketBefore?.title ?? null,
          previousStatus: marketBefore?.status ?? null,
          category: marketBefore?.category ?? null,
          winningOutcomeId,
          winningOutcomeCode: winningOutcome?.code ?? null,
          winningOutcomeName: winningOutcome?.name ?? null,
          resolutionNote,
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