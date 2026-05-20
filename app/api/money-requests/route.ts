import { NextRequest, NextResponse } from "next/server"
import { getApiUser } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import {
  buildRateLimitKey,
  enforceRateLimit,
  getRequestIp,
} from "@/lib/rate-limit"

/**
 * /api/money-requests
 *
 * GET:
 * - Logged-in user sees own deposit/withdrawal requests.
 *
 * POST:
 * - Logged-in user creates deposit/withdrawal request.
 *
 * Security:
 * - User identity comes from Supabase access token.
 * - We do not trust user_id from frontend.
 * - Deposit/withdrawal limits are enforced in the database RPC.
 */

type MoneyRequestType = "deposit" | "withdrawal"

function isValidType(value: unknown): value is MoneyRequestType {
  return value === "deposit" || value === "withdrawal"
}

/**
 * GET /api/money-requests
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getApiUser(req)

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please login first.", requests: [] },
        { status: 401 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from("money_requests")
      .select(`
        id,
        user_id,
        type,
        status,
        amount_cents,
        payment_method,
        payment_reference,
        account_name,
        account_number,
        user_note,
        reviewed_by,
        reviewed_at,
        admin_note,
        created_at,
        updated_at
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: error.message, requests: [] },
        { status: 400 }
      )
    }

    return NextResponse.json({
      requests: data ?? [],
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error"

    return NextResponse.json(
      { error: message, requests: [] },
      { status: 500 }
    )
  }
}

/**
 * POST /api/money-requests
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getApiUser(req)

    /**
     * Rate limit request creation.
     *
     * This protects deposit/withdrawal request spam.
     */
    const ip = getRequestIp(req)

    const limited = enforceRateLimit({
      key: buildRateLimitKey(["money-requests:post", user?.id, ip]),
      limit: 10,
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

    const type = body.type
    const amountCents = Number(body.amountCents)

    const paymentMethod =
      typeof body.paymentMethod === "string" ? body.paymentMethod.trim() : ""

    const paymentReference =
      typeof body.paymentReference === "string"
        ? body.paymentReference.trim()
        : ""

    const accountName =
      typeof body.accountName === "string" ? body.accountName.trim() : ""

    const accountNumber =
      typeof body.accountNumber === "string" ? body.accountNumber.trim() : ""

    const userNote =
      typeof body.userNote === "string" ? body.userNote.trim() : ""

    if (!isValidType(type)) {
      return NextResponse.json(
        { error: "type must be deposit or withdrawal." },
        { status: 400 }
      )
    }

    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      return NextResponse.json(
        { error: "amountCents must be a positive integer." },
        { status: 400 }
      )
    }

    if (type === "deposit" && !paymentMethod) {
      return NextResponse.json(
        { error: "paymentMethod is required for deposits." },
        { status: 400 }
      )
    }

    if (type === "withdrawal" && (!accountName || !accountNumber)) {
      return NextResponse.json(
        { error: "accountName and accountNumber are required for withdrawals." },
        { status: 400 }
      )
    }

    /**
     * The database RPC enforces:
     * - profile completion
     * - verification status
     * - deposit limit
     * - withdrawal limit
     * - withdrawal balance locking
     */
    const { data, error } = await supabaseAdmin.rpc("create_money_request", {
      p_user_id: user.id,
      p_type: type,
      p_amount_cents: amountCents,
      p_payment_method: paymentMethod || null,
      p_payment_reference: paymentReference || null,
      p_account_name: accountName || null,
      p_account_number: accountNumber || null,
      p_user_note: userNote || null,
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      result: data,
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