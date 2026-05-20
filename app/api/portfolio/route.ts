import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { getApiUser } from "@/lib/api-auth"

/**
 * GET /api/portfolio
 *
 * Returns the logged-in user's Qwikeer portfolio:
 * - wallet balance
 * - positions
 * - open orders
 *
 * Security:
 * - We do not accept user_id from query params.
 * - The user is verified through the Supabase access token.
 */

export async function GET(req: NextRequest) {
  try {
    /**
     * Step 1:
     * Verify logged-in user.
     */
    const user = await getApiUser(req)

    if (!user) {
      return NextResponse.json(
        {
          error: "Unauthorized. Please login first.",
          wallet: null,
          positions: [],
          openOrders: [],
        },
        { status: 401 }
      )
    }

    /**
     * Step 2:
     * Fetch wallet.
     */
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from("wallets")
      .select("user_id, available_cents, locked_cents, updated_at")
      .eq("user_id", user.id)
      .maybeSingle()

    if (walletError) {
      return NextResponse.json(
        {
          error: walletError.message,
          wallet: null,
          positions: [],
          openOrders: [],
        },
        { status: 400 }
      )
    }

    /**
     * Step 3:
     * Fetch active positions.
     */
    const { data: positionsRaw, error: positionsError } = await supabaseAdmin
      .from("positions")
      .select(`
        id,
        user_id,
        market_id,
        outcome_id,
        available_quantity,
        locked_quantity,
        avg_price_cents,
        updated_at
      `)
      .eq("user_id", user.id)
      .or("available_quantity.gt.0,locked_quantity.gt.0")
      .order("updated_at", { ascending: false })

    if (positionsError) {
      return NextResponse.json(
        {
          error: positionsError.message,
          wallet: wallet ?? null,
          positions: [],
          openOrders: [],
        },
        { status: 400 }
      )
    }

    /**
     * Step 4:
     * Fetch open / partial orders.
     */
    const { data: ordersRaw, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select(`
        id,
        user_id,
        market_id,
        outcome_id,
        side,
        price_cents,
        quantity,
        filled_quantity,
        remaining_quantity,
        status,
        created_at,
        updated_at
      `)
      .eq("user_id", user.id)
      .in("status", ["open", "partial"])
      .order("created_at", { ascending: false })

    if (ordersError) {
      return NextResponse.json(
        {
          error: ordersError.message,
          wallet: wallet ?? null,
          positions: positionsRaw ?? [],
          openOrders: [],
        },
        { status: 400 }
      )
    }

    const positions = positionsRaw ?? []
    const openOrders = ordersRaw ?? []

    /**
     * Step 5:
     * Fetch related market and outcome display data separately.
     *
     * We avoid embedded relationships because markets/outcomes have multiple
     * foreign key relationships.
     */
    const marketIds = Array.from(
      new Set([
        ...positions.map((position) => position.market_id),
        ...openOrders.map((order) => order.market_id),
      ])
    ).filter(Boolean)

    const outcomeIds = Array.from(
      new Set([
        ...positions.map((position) => position.outcome_id),
        ...openOrders.map((order) => order.outcome_id),
      ])
    ).filter(Boolean)

    let markets: any[] = []
    let outcomes: any[] = []

    if (marketIds.length > 0) {
      const { data: marketsData, error: marketsError } = await supabaseAdmin
        .from("markets")
        .select("id, title, category, status, closes_at, resolved_outcome_id")
        .in("id", marketIds)

      if (marketsError) {
        return NextResponse.json(
          {
            error: marketsError.message,
            wallet: wallet ?? null,
            positions: [],
            openOrders: [],
          },
          { status: 400 }
        )
      }

      markets = marketsData ?? []
    }

    if (outcomeIds.length > 0) {
      const { data: outcomesData, error: outcomesError } = await supabaseAdmin
        .from("outcomes")
        .select("id, market_id, code, name, sort_order")
        .in("id", outcomeIds)

      if (outcomesError) {
        return NextResponse.json(
          {
            error: outcomesError.message,
            wallet: wallet ?? null,
            positions: [],
            openOrders: [],
          },
          { status: 400 }
        )
      }

      outcomes = outcomesData ?? []
    }

    /**
     * Step 6:
     * Enrich positions with market/outcome labels.
     */
    const enrichedPositions = positions.map((position) => ({
      ...position,
      market:
        markets.find((market) => market.id === position.market_id) ?? null,
      outcome:
        outcomes.find((outcome) => outcome.id === position.outcome_id) ?? null,
    }))

    /**
     * Step 7:
     * Enrich open orders with market/outcome labels.
     */
    const enrichedOpenOrders = openOrders.map((order) => ({
      ...order,
      market: markets.find((market) => market.id === order.market_id) ?? null,
      outcome: outcomes.find((outcome) => outcome.id === order.outcome_id) ?? null,
    }))

    return NextResponse.json({
      wallet: wallet ?? {
        user_id: user.id,
        available_cents: 0,
        locked_cents: 0,
      },
      positions: enrichedPositions,
      openOrders: enrichedOpenOrders,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error"

    return NextResponse.json(
      {
        error: message,
        wallet: null,
        positions: [],
        openOrders: [],
      },
      { status: 500 }
    )
  }
}