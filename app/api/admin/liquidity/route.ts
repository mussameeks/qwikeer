import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { getApiUser } from "@/lib/api-auth"
import {
  buildRateLimitKey,
  enforceRateLimit,
  getRequestIp,
} from "@/lib/rate-limit"

/**
 * POST /api/admin/liquidity
 *
 * DEV-ONLY admin test market maker endpoint.
 *
 * Audit:
 * - Writes liquidity_created into admin_audit_logs.
 */

type LiquiditySide = "buy" | "sell"

function devToolsEnabled() {
  return process.env.QWIKEER_DEV_TOOLS_ENABLED === "true"
}

function isValidSide(value: unknown): value is LiquiditySide {
  return value === "buy" || value === "sell"
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

export async function POST(req: NextRequest) {
  try {
    if (!devToolsEnabled()) {
      return NextResponse.json(
        {
          error:
            "Development tools are disabled. Admin liquidity tool is not available.",
        },
        { status: 403 }
      )
    }

    const { user, errorResponse } = await requireAdmin(req)

    if (errorResponse) {
      return errorResponse
    }

    const ip = getRequestIp(req)

    const limited = enforceRateLimit({
      key: buildRateLimitKey(["admin-liquidity:post", user?.id, ip]),
      limit: 20,
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

    const marketId = String(body.marketId || "")
    const outcomeId = String(body.outcomeId || "")
    const side = body.side
    const priceCents = Number(body.priceCents)
    const quantity = Number(body.quantity)
    const autoFund = body.autoFund === false ? false : true

    if (!marketId) {
      return NextResponse.json(
        { error: "marketId is required." },
        { status: 400 }
      )
    }

    if (!outcomeId) {
      return NextResponse.json(
        { error: "outcomeId is required." },
        { status: 400 }
      )
    }

    if (!isValidSide(side)) {
      return NextResponse.json(
        { error: "side must be buy or sell." },
        { status: 400 }
      )
    }

    if (!Number.isInteger(priceCents) || priceCents < 1 || priceCents > 99) {
      return NextResponse.json(
        { error: "priceCents must be an integer between 1 and 99." },
        { status: 400 }
      )
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json(
        { error: "quantity must be a positive integer." },
        { status: 400 }
      )
    }

    const { data: market, error: marketError } = await supabaseAdmin
      .from("markets")
      .select("id, status, title, category")
      .eq("id", marketId)
      .maybeSingle()

    if (marketError) {
      return NextResponse.json(
        { error: marketError.message },
        { status: 400 }
      )
    }

    if (!market) {
      return NextResponse.json(
        { error: "Market not found." },
        { status: 404 }
      )
    }

    if (market.status !== "open") {
      return NextResponse.json(
        { error: "Market must be open to add liquidity." },
        { status: 400 }
      )
    }

    const { data: outcome, error: outcomeError } = await supabaseAdmin
      .from("outcomes")
      .select("id, market_id, code, name")
      .eq("id", outcomeId)
      .eq("market_id", marketId)
      .maybeSingle()

    if (outcomeError) {
      return NextResponse.json(
        { error: outcomeError.message },
        { status: 400 }
      )
    }

    if (!outcome) {
      return NextResponse.json(
        { error: "Outcome does not belong to market." },
        { status: 400 }
      )
    }

    if (side === "buy" && autoFund) {
      const requiredCents = priceCents * quantity

      const { error: creditError } = await supabaseAdmin.rpc(
        "credit_demo_balance",
        {
          p_admin_user_id: user.id,
          p_target_user_id: user.id,
          p_amount_cents: requiredCents,
        }
      )

      if (creditError) {
        return NextResponse.json(
          { error: creditError.message },
          { status: 400 }
        )
      }
    }

    if (side === "sell") {
      if (autoFund) {
        const mintCostCents = quantity * 100

        const { error: creditError } = await supabaseAdmin.rpc(
          "credit_demo_balance",
          {
            p_admin_user_id: user.id,
            p_target_user_id: user.id,
            p_amount_cents: mintCostCents,
          }
        )

        if (creditError) {
          return NextResponse.json(
            { error: creditError.message },
            { status: 400 }
          )
        }
      }

      const { error: mintError } = await supabaseAdmin.rpc(
        "mint_complete_sets",
        {
          p_user_id: user.id,
          p_market_id: marketId,
          p_quantity: quantity,
        }
      )

      if (mintError) {
        return NextResponse.json(
          { error: mintError.message },
          { status: 400 }
        )
      }
    }

    const { data: orderData, error: orderError } = await supabaseAdmin.rpc(
      "place_order",
      {
        p_user_id: user.id,
        p_market_id: marketId,
        p_outcome_id: outcomeId,
        p_side: side,
        p_price_cents: priceCents,
        p_quantity: quantity,
        p_client_order_id: `liquidity-${crypto.randomUUID()}`,
      }
    )

    if (orderError) {
      return NextResponse.json(
        { error: orderError.message },
        { status: 400 }
      )
    }

    const result = {
      marketId,
      marketTitle: market.title,
      outcomeId,
      outcomeCode: outcome.code,
      side,
      priceCents,
      quantity,
      autoFund,
      order: orderData?.[0] ?? null,
    }

    const { error: auditError } = await supabaseAdmin.rpc(
      "write_admin_audit_log",
      {
        p_admin_user_id: user.id,
        p_action: "liquidity_created",
        p_target_type: "liquidity",
        p_target_id: marketId,
        p_summary: `Created ${side.toUpperCase()} liquidity for ${outcome.code}`,
        p_metadata: {
          ...result,
          marketCategory: market.category ?? null,
          devTool: true,
        },
      }
    )

    return NextResponse.json({
      success: true,
      liquidity: result,
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