import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * GET /api/orderbook
 *
 * Query params:
 * - marketId
 * - outcomeId
 *
 * Returns aggregated orderbook:
 * - bids: buy orders grouped by price
 * - asks: sell orders grouped by price
 *
 * This endpoint is public-readable market data.
 */

type OrderbookRow = {
  price_cents: number
  remaining_quantity: number
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const marketId = searchParams.get("marketId")
    const outcomeId = searchParams.get("outcomeId")

    if (!marketId || !outcomeId) {
      return NextResponse.json(
        {
          error: "marketId and outcomeId are required.",
          bids: [],
          asks: [],
        },
        { status: 400 }
      )
    }

    /**
     * Active buy orders.
     * Highest price should appear first.
     */
    const { data: bidsRaw, error: bidsError } = await supabaseAdmin
      .from("orders")
      .select("price_cents, remaining_quantity")
      .eq("market_id", marketId)
      .eq("outcome_id", outcomeId)
      .eq("side", "buy")
      .in("status", ["open", "partial"])
      .gt("remaining_quantity", 0)
      .order("price_cents", { ascending: false })

    if (bidsError) {
      return NextResponse.json(
        {
          error: bidsError.message,
          bids: [],
          asks: [],
        },
        { status: 400 }
      )
    }

    /**
     * Active sell orders.
     * Lowest price should appear first.
     */
    const { data: asksRaw, error: asksError } = await supabaseAdmin
      .from("orders")
      .select("price_cents, remaining_quantity")
      .eq("market_id", marketId)
      .eq("outcome_id", outcomeId)
      .eq("side", "sell")
      .in("status", ["open", "partial"])
      .gt("remaining_quantity", 0)
      .order("price_cents", { ascending: true })

    if (asksError) {
      return NextResponse.json(
        {
          error: asksError.message,
          bids: [],
          asks: [],
        },
        { status: 400 }
      )
    }

    const bids = aggregateLevels(bidsRaw ?? [], "desc")
    const asks = aggregateLevels(asksRaw ?? [], "asc")

    return NextResponse.json({
      bids,
      asks,
      bestBid: bids[0] ?? null,
      bestAsk: asks[0] ?? null,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error"

    return NextResponse.json(
      {
        error: message,
        bids: [],
        asks: [],
      },
      { status: 500 }
    )
  }
}

/**
 * Groups order rows by price.
 */
function aggregateLevels(rows: OrderbookRow[], direction: "asc" | "desc") {
  const map = new Map<number, number>()

  for (const row of rows) {
    const price = Number(row.price_cents || 0)
    const qty = Number(row.remaining_quantity || 0)

    if (price <= 0 || qty <= 0) continue

    map.set(price, (map.get(price) ?? 0) + qty)
  }

  const levels = Array.from(map.entries()).map(([priceCents, quantity]) => ({
    priceCents,
    quantity,
    valueCents: priceCents * quantity,
  }))

  return levels.sort((a, b) => {
    if (direction === "asc") {
      return a.priceCents - b.priceCents
    }

    return b.priceCents - a.priceCents
  })
}