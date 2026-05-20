import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * GET /api/markets/[id]
 *
 * Public endpoint for one market detail.
 *
 * Returns:
 * - market details
 * - outcomes
 * - recent trades
 * - estimated YES/NO price
 * - volume
 */

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    /**
     * Step 1:
     * Fetch the market.
     */
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
        created_at
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

    /**
     * Step 2:
     * Fetch outcomes separately.
     */
    const { data: outcomesData, error: outcomesError } = await supabaseAdmin
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

    /**
     * Step 3:
     * Fetch recent trades.
     */
    const { data: tradesData, error: tradesError } = await supabaseAdmin
      .from("trades")
      .select("id, market_id, outcome_id, price_cents, quantity, created_at")
      .eq("market_id", id)
      .order("created_at", { ascending: false })
      .limit(50)

    if (tradesError) {
      return NextResponse.json(
        { error: tradesError.message },
        { status: 400 }
      )
    }

    const outcomes = outcomesData ?? []
    const trades = tradesData ?? []

    const yesOutcome = outcomes.find(
      (outcome) => String(outcome.code).toUpperCase() === "YES"
    )

    const yesTrades = yesOutcome
      ? trades.filter((trade) => trade.outcome_id === yesOutcome.id)
      : []

    const lastYesTrade = yesTrades[0]
    const yesPrice = Number(lastYesTrade?.price_cents ?? 50)
    const noPrice = 100 - yesPrice

    const volumeCents = trades.reduce((sum, trade) => {
      return (
        sum +
        Number(trade.quantity || 0) * Number(trade.price_cents || 0)
      )
    }, 0)

    return NextResponse.json({
      ...market,
      outcomes,
      trades,
      yesPrice,
      noPrice,
      volumeCents,
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