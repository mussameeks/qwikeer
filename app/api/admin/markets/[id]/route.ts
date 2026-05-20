import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { getApiUser } from "@/lib/api-auth"

/**
 * /api/admin/markets/[id]
 *
 * GET:
 * - Fetch one market with outcomes for editing.
 *
 * PATCH:
 * - Update market title, description, category, closes_at, status.
 *
 * DELETE:
 * - Delete draft market only.
 *
 * Audit:
 * - market_updated
 * - market_deleted
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

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { errorResponse } = await requireAdmin(req)

    if (errorResponse) {
      return errorResponse
    }

    const { id } = await context.params

    const { data: market, error: marketError } = await supabaseAdmin
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
      .eq("id", id)
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

    const { data: outcomes, error: outcomesError } = await supabaseAdmin
      .from("outcomes")
      .select("id, market_id, code, name, sort_order")
      .eq("market_id", id)
      .order("sort_order", { ascending: true })

    if (outcomesError) {
      return NextResponse.json(
        { error: outcomesError.message },
        { status: 400 }
      )
    }

    const { count: ordersCount, error: ordersCountError } = await supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("market_id", id)

    if (ordersCountError) {
      return NextResponse.json(
        { error: ordersCountError.message },
        { status: 400 }
      )
    }

    const { count: tradesCount, error: tradesCountError } = await supabaseAdmin
      .from("trades")
      .select("id", { count: "exact", head: true })
      .eq("market_id", id)

    if (tradesCountError) {
      return NextResponse.json(
        { error: tradesCountError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      market: {
        ...market,
        outcomes: outcomes ?? [],
        ordersCount: ordersCount ?? 0,
        tradesCount: tradesCount ?? 0,
      },
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

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

    const { id } = await context.params
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
        : ""

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

    const { data: existingMarket, error: existingError } = await supabaseAdmin
      .from("markets")
      .select("id, title, description, category, status, closes_at")
      .eq("id", id)
      .maybeSingle()

    if (existingError) {
      return NextResponse.json(
        { error: existingError.message },
        { status: 400 }
      )
    }

    if (!existingMarket) {
      return NextResponse.json(
        { error: "Market not found." },
        { status: 404 }
      )
    }

    if (existingMarket.status === "resolved") {
      return NextResponse.json(
        { error: "Resolved markets cannot be edited." },
        { status: 400 }
      )
    }

    if (existingMarket.status === "cancelled") {
      return NextResponse.json(
        { error: "Cancelled markets cannot be edited." },
        { status: 400 }
      )
    }

    const { data: market, error: updateError } = await supabaseAdmin
      .from("markets")
      .update({
        title,
        description,
        category,
        closes_at: closesAt,
        status,
      })
      .eq("id", id)
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

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      )
    }

    const { error: auditError } = await supabaseAdmin.rpc(
      "write_admin_audit_log",
      {
        p_admin_user_id: user.id,
        p_action: "market_updated",
        p_target_type: "market",
        p_target_id: id,
        p_summary: "Updated market details",
        p_metadata: {
          marketId: id,
          before: {
            title: existingMarket.title,
            description: existingMarket.description,
            category: existingMarket.category,
            status: existingMarket.status,
            closesAt: existingMarket.closes_at,
          },
          after: {
            title,
            description,
            category,
            status,
            closesAt,
          },
        },
      }
    )

    return NextResponse.json({
      success: true,
      market,
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

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

    const { id } = await context.params

    const { data: market, error: marketError } = await supabaseAdmin
      .from("markets")
      .select("id, title, status, category")
      .eq("id", id)
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

    if (market.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft markets can be deleted." },
        { status: 400 }
      )
    }

    const { count: ordersCount, error: ordersCountError } = await supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("market_id", id)

    if (ordersCountError) {
      return NextResponse.json(
        { error: ordersCountError.message },
        { status: 400 }
      )
    }

    const { count: tradesCount, error: tradesCountError } = await supabaseAdmin
      .from("trades")
      .select("id", { count: "exact", head: true })
      .eq("market_id", id)

    if (tradesCountError) {
      return NextResponse.json(
        { error: tradesCountError.message },
        { status: 400 }
      )
    }

    if ((ordersCount ?? 0) > 0 || (tradesCount ?? 0) > 0) {
      return NextResponse.json(
        { error: "Markets with orders or trades cannot be deleted." },
        { status: 400 }
      )
    }

    const { error: deleteError } = await supabaseAdmin
      .from("markets")
      .delete()
      .eq("id", id)

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 400 }
      )
    }

    const { error: auditError } = await supabaseAdmin.rpc(
      "write_admin_audit_log",
      {
        p_admin_user_id: user.id,
        p_action: "market_deleted",
        p_target_type: "market",
        p_target_id: id,
        p_summary: "Deleted draft market",
        p_metadata: {
          marketId: id,
          marketTitle: market.title,
          previousStatus: market.status,
          category: market.category,
          ordersCount: ordersCount ?? 0,
          tradesCount: tradesCount ?? 0,
        },
      }
    )

    return NextResponse.json({
      success: true,
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