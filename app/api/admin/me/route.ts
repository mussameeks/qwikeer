import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { getApiUser } from "@/lib/api-auth"

/**
 * GET /api/admin/me
 *
 * Checks whether the currently logged-in user is a Qwikeer admin.
 *
 * Source of truth:
 * - public.market_admins
 *
 * Security:
 * - We do not trust frontend role values.
 * - We verify the user from the Supabase access token.
 */

export async function GET(req: NextRequest) {
  try {
    /**
     * Step 1:
     * Read the authenticated user from the Authorization header.
     */
    const user = await getApiUser(req)

    if (!user) {
      return NextResponse.json(
        {
          isAdmin: false,
          error: "Unauthorized. Please login first.",
        },
        { status: 401 }
      )
    }

    /**
     * Step 2:
     * Check whether this user exists in public.market_admins.
     */
    const { data, error } = await supabaseAdmin
      .from("market_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        {
          isAdmin: false,
          error: error.message,
        },
        { status: 400 }
      )
    }

    /**
     * Step 3:
     * Return admin status.
     */
    return NextResponse.json({
      isAdmin: Boolean(data),
      userId: user.id,
      email: user.email,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error"

    return NextResponse.json(
      {
        isAdmin: false,
        error: message,
      },
      { status: 500 }
    )
  }
}