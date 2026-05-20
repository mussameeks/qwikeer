import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { getApiUser } from "@/lib/api-auth"
import { buildRateLimitKey,enforceRateLimit, getRequestIp,} from "@/lib/rate-limit"

/**
 * /api/orders
 *
 * GET:
 * - Returns logged-in user's orders.
 *
 * POST:
 * - Places a new order through the secured database RPC place_order().
 *
 * Security:
 * - We do not trust user_id from query params/body.
 * - User identity comes from Supabase access token.
 */

type OrderSide = "buy" | "sell"

function isValidSide(value: unknown): value is OrderSide {
  return value === "buy" || value === "sell"
}

/**
 * GET /api/orders
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getApiUser(req)
    if (!user) {
      return NextResponse.json(
        {
          error: "Unauthorized. Please login first.",
          orders: [],
        },
        { status: 401 }
      )
    }

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
      .order("created_at", { ascending: false })

    if (ordersError) {
      return NextResponse.json(
        {
          error: ordersError.message,
          orders: [],
        },
        { status: 400 }
      )
    }

    const orders = ordersRaw ?? []

    const marketIds = Array.from(
      new Set(orders.map((order) => order.market_id))
    ).filter(Boolean)

    const outcomeIds = Array.from(
      new Set(orders.map((order) => order.outcome_id))
    ).filter(Boolean)

    let markets: any[] = []
    let outcomes: any[] = []

    if (marketIds.length > 0) {
      const { data: marketsData, error: marketsError } = await supabaseAdmin
        .from("markets")
        .select("id, title, category, status, closes_at")
        .in("id", marketIds)

      if (marketsError) {
        return NextResponse.json(
          {
            error: marketsError.message,
            orders: [],
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
            orders: [],
          },
          { status: 400 }
        )
      }

      outcomes = outcomesData ?? []
    }

    const enrichedOrders = orders.map((order) => ({
      ...order,
      market: markets.find((market) => market.id === order.market_id) ?? null,
      outcome:
        outcomes.find((outcome) => outcome.id === order.outcome_id) ?? null,
    }))

    return NextResponse.json({
      orders: enrichedOrders,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error"

    return NextResponse.json(
      {
        error: message,
        orders: [],
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/orders
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getApiUser(req)

    const ip = getRequestIp(req)

    const limited = enforceRateLimit({
      key: buildRateLimitKey(["orders:post", user?.id, ip]),
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

    // rest of your existing code...

    const body = await req.json()

    const marketId = String(body.marketId || "")
    const outcomeId = String(body.outcomeId || "")
    const side = body.side
    const priceCents = Number(body.priceCents)
    const quantity = Number(body.quantity)

    const clientOrderId =
      typeof body.clientOrderId === "string" && body.clientOrderId.trim()
        ? body.clientOrderId.trim()
        : crypto.randomUUID()

    if (!marketId || !outcomeId) {
      return NextResponse.json(
        { error: "Market and outcome are required." },
        { status: 400 }
      )
    }

    if (!isValidSide(side)) {
      return NextResponse.json(
        { error: "Side must be buy or sell." },
        { status: 400 }
      )
    }

    if (!Number.isInteger(priceCents) || priceCents < 1 || priceCents > 99) {
      return NextResponse.json(
        { error: "Price must be an integer between 1 and 99 cents." },
        { status: 400 }
      )
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json(
        { error: "Quantity must be a positive integer." },
        { status: 400 }
      )
    }

    /**
     * Call secure database matching engine.
     */
    const { data, error } = await supabaseAdmin.rpc("place_order", {
      p_user_id: user.id,
      p_market_id: marketId,
      p_outcome_id: outcomeId,
      p_side: side,
      p_price_cents: priceCents,
      p_quantity: quantity,
      p_client_order_id: clientOrderId,
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      order: data?.[0] ?? null,
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