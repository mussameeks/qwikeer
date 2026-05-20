import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * GET /api/markets
 *
 * Public endpoint for listing Qwikeer markets.
 *
 * Returns:
 * - markets
 * - outcomes
 * - estimated YES/NO price
 * - volume
 */

export async function GET() {
  try {
    /**
     * Step 1:
     * Fetch all markets.
     */
    const { data: markets, error: marketsError } = await supabaseAdmin
      .from("markets")
      .select(`
        id,
        title,
        description,
        category,
        status,
        closes_at,
        resolved_outcome_id,
        created_at
      `)
      .order("created_at", { ascending: false })

    if (marketsError) {
      return NextResponse.json(
        { error: marketsError.message },
        { status: 400 }
      )
    }

    const marketIds = (markets ?? []).map((market) => market.id)

    let outcomes: any[] = []
    let trades: any[] = []

    /**
     * Step 2:
     * Fetch outcomes and trades separately.
     */
    if (marketIds.length > 0) {
      const { data: outcomesData, error: outcomesError } = await supabaseAdmin
        .from("outcomes")
        .select("id, market_id, code, name, sort_order")
        .in("market_id", marketIds)
        .order("sort_order", { ascending: true })

      if (outcomesError) {
        return NextResponse.json(
          { error: outcomesError.message },
          { status: 400 }
        )
      }

      outcomes = outcomesData ?? []

      const { data: tradesData, error: tradesError } = await supabaseAdmin
        .from("trades")
        .select("market_id, outcome_id, price_cents, quantity, created_at")
        .in("market_id", marketIds)
        .order("created_at", { ascending: false })

      if (tradesError) {
        return NextResponse.json(
          { error: tradesError.message },
          { status: 400 }
        )
      }

      trades = tradesData ?? []
    }

    /**
     * Step 3:
     * Attach outcomes and price estimates.
     */
    const result = (markets ?? []).map((market) => {
      const marketOutcomes = outcomes.filter(
        (outcome) => outcome.market_id === market.id
      )

      const yesOutcome = marketOutcomes.find(
        (outcome) => String(outcome.code).toUpperCase() === "YES"
      )

      const marketTrades = trades.filter(
        (trade) => trade.market_id === market.id
      )

      const yesTrades = yesOutcome
        ? marketTrades.filter((trade) => trade.outcome_id === yesOutcome.id)
        : []

      const lastYesTrade = yesTrades[0]

      const yesPrice = Number(lastYesTrade?.price_cents ?? 50)
      const noPrice = 100 - yesPrice

      const volumeCents = marketTrades.reduce((sum, trade) => {
        return (
          sum +
          Number(trade.quantity || 0) * Number(trade.price_cents || 0)
        )
      }, 0)

      return {
        ...market,
        outcomes: marketOutcomes,
        yesPrice,
        noPrice,
        volumeCents,
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error"

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}