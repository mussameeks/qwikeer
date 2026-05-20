import { createClient } from "@supabase/supabase-js"
import { NextRequest } from "next/server"

/**
 * getApiUser()
 *
 * This helper verifies the logged-in user from the Authorization header.
 *
 * Frontend should call protected APIs like:
 *
 * fetch("/api/protected-route", {
 *   headers: {
 *     Authorization: `Bearer ${session.access_token}`,
 *   },
 * })
 *
 * Why this matters:
 * - We do not trust user_id from query params or request body.
 * - We verify the real user from Supabase Auth.
 * - This prevents users from pretending to be another user.
 */

export async function getApiUser(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    throw new Error("Missing Supabase public environment variables")
  }

  const authHeader = req.headers.get("authorization")

  if (!authHeader) {
    return null
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}