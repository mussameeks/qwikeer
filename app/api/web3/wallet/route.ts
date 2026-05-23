import { NextRequest, NextResponse } from "next/server"
import { getApiUser } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * /api/web3/wallet
 *
 * GET:
 * - User reads saved Web3 wallet account.
 *
 * POST:
 * - User saves embedded wallet address from Privy.
 */

function normalizeAddress(address: string) {
  return address.trim().toLowerCase()
}

function isEvmAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function getDbChain() {
  const configuredChain = process.env.NEXT_PUBLIC_WEB3_CHAIN

  if (configuredChain === "base") {
    return "base"
  }

  return "base_sepolia"
}

export async function GET(req: NextRequest) {
  try {
    const user = await getApiUser(req)

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please login first.", wallet: null },
        { status: 401 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from("web3_wallet_accounts")
      .select(`
        id,
        user_id,
        provider,
        chain,
        embedded_wallet_address,
        smart_account_address,
        is_primary,
        metadata,
        created_at,
        updated_at
      `)
      .eq("user_id", user.id)
      .eq("chain", getDbChain())
      .eq("provider", "privy")
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { error: error.message, wallet: null },
        { status: 400 }
      )
    }

    return NextResponse.json({
      wallet: data ?? null,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error"

    return NextResponse.json(
      { error: message, wallet: null },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getApiUser(req)

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please login first." },
        { status: 401 }
      )
    }

    const body = await req.json()

    const embeddedWalletAddress =
      typeof body.embeddedWalletAddress === "string"
        ? normalizeAddress(body.embeddedWalletAddress)
        : ""

    const smartAccountAddress =
      typeof body.smartAccountAddress === "string" &&
      body.smartAccountAddress.trim()
        ? normalizeAddress(body.smartAccountAddress)
        : null

    if (!isEvmAddress(embeddedWalletAddress)) {
      return NextResponse.json(
        { error: "Invalid embedded wallet address." },
        { status: 400 }
      )
    }

    if (smartAccountAddress && !isEvmAddress(smartAccountAddress)) {
      return NextResponse.json(
        { error: "Invalid smart account address." },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin.rpc(
      "upsert_web3_wallet_account",
      {
        p_user_id: user.id,
        p_provider: "privy",
        p_chain: getDbChain(),
        p_embedded_wallet_address: embeddedWalletAddress,
        p_smart_account_address: smartAccountAddress,
        p_metadata: {
          source: "privy_embedded_wallet",
          savedAt: new Date().toISOString(),
        },
      }
    )

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

    return NextResponse.json({ error: message }, { status: 500 })
  }
}