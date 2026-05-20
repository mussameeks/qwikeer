import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { getApiUser } from "@/lib/api-auth"

/**
 * /api/admin/markets
 *
 * GET:
 * - Admin lists all markets with outcomes.
 *
 * POST:
 * - Admin creates a new YES/NO market.
 *
 * Audit:
 * - POST writes market_created into admin_audit_logs.
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

/**
 * GET /api/admin/markets
 */
export async function GET(req: NextRequest) {
  try {
    const { errorResponse } = await requireAdmin(req)

    if (errorResponse) {
      return errorResponse
    }

    const { data: marketsRaw, error: marketsError } = await supabaseAdmin
      .from("markets")
      .select(`
        id,
        title,
        description,
        category,
        status,
        closes_at,
        resolved_outcome_id,
        resolution_note,
        created_at,
        updated_at
      `)
      .order("created_at", { ascending: false })

    if (marketsError) {
      return NextResponse.json(
        { error: marketsError.message, markets: [] },
        { status: 400 }
      )
    }

    const markets = marketsRaw ?? []
    const marketIds = markets.map((market) => market.id)

    let outcomes: any[] = []

    if (marketIds.length > 0) {
      const { data: outcomesRaw, error: outcomesError } = await supabaseAdmin
        .from("outcomes")
        .select("id, market_id, code, name, sort_order")
        .in("market_id", marketIds)
        .order("sort_order", { ascending: true })

      if (outcomesError) {
        return NextResponse.json(
          { error: outcomesError.message, markets: [] },
          { status: 400 }
        )
      }

      outcomes = outcomesRaw ?? []
    }

    const enrichedMarkets = markets.map((market) => ({
      ...market,
      outcomes: outcomes.filter((outcome) => outcome.market_id === market.id),
    }))

    return NextResponse.json({
      markets: enrichedMarkets,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error"

    return NextResponse.json(
      { error: message, markets: [] },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/markets
 */
export async function POST(req: NextRequest) {
  try {
    const { user, errorResponse } = await requireAdmin(req)

    if (errorResponse) {
      return errorResponse
    }

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please login first." },
        { status: 401 }
      )
    }

    const body = await req.json()

    const title = typeof body.title === "string" ? body.title.trim() : ""
    const description =
      typeof body.description === "string" ? body.description.trim() : ""
    const category =
      typeof body.category === "string" && body.category.trim()
        ? body.category.trim()
        : "General"

    const closesAt =
      typeof body.closesAt === "string" && body.closesAt.trim()
        ? body.closesAt
        : null

    const status =
      typeof body.status === "string" && body.status.trim()
        ? body.status
        : "open"

    if (!title) {
      return NextResponse.json(
        { error: "Market title is required." },
        { status: 400 }
      )
    }

    if (!["draft", "open", "paused", "closed"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Use draft, open, paused, or closed." },
        { status: 400 }
      )
    }

    /**
     * Create market.
     */
    const { data: market, error: marketError } = await supabaseAdmin
      .from("markets")
      .insert({
        title,
        description,
        category,
        closes_at: closesAt,
        status,
      })
      .select(`
        id,
        title,
        description,
        category,
        status,
        closes_at,
        resolved_outcome_id,
        resolution_note,
        created_at,
        updated_at
      `)
      .single()

    if (marketError) {
      return NextResponse.json(
        { error: marketError.message },
        { status: 400 }
      )
    }

    /**
     * Create default YES/NO outcomes.
     */
    const { data: outcomes, error: outcomesError } = await supabaseAdmin
      .from("outcomes")
      .insert([
        {
          market_id: market.id,
          code: "YES",
          name: "Yes",
          sort_order: 1,
        },
        {
          market_id: market.id,
          code: "NO",
          name: "No",
          sort_order: 2,
        },
      ])
      .select("id, market_id, code, name, sort_order")
      .order("sort_order", { ascending: true })

    if (outcomesError) {
      return NextResponse.json(
        { error: outcomesError.message },
        { status: 400 }
      )
    }

    /**
     * Audit log.
     */
    const { error: auditError } = await supabaseAdmin.rpc(
      "write_admin_audit_log",
      {
        p_admin_user_id: user.id,
        p_action: "market_created",
        p_target_type: "market",
        p_target_id: market.id,
        p_summary: "Created new YES/NO market",
        p_metadata: {
          marketId: market.id,
          title,
          description,
          category,
          closesAt,
          status,
          outcomes: outcomes ?? [],
        },
      }
    )

    return NextResponse.json({
      success: true,
      market: {
        ...market,
        outcomes: outcomes ?? [],
      },
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