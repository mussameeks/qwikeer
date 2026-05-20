import { createClient } from "@supabase/supabase-js"

/**
 * Server-only Supabase admin client.
 *
 * This client uses SUPABASE_SERVICE_ROLE_KEY.
 *
 * Important:
 * - Never import this file inside client components.
 * - Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
 * - Use this only inside API routes and server-side logic.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL")
}

if (!serviceRoleKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY")
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})