import { NextRequest, NextResponse } from "next/server"
import { getApiUser } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * GET /api/admin/environment
 *
 * Admin-only environment + database validation.
 *
 * This does not expose actual secret values.
 * It only returns whether required variables are configured
 * and whether important database objects exist.
 */

async function requireAdmin(req: NextRequest) {
  const user = await getApiUser(req)

  if (!user) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: "Unauthorized. Please login first." },
        { status: 401 }
      ),
    }
  }

  const { data: adminRecord, error: adminError } = await supabaseAdmin
    .from("market_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (adminError) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: adminError.message },
        { status: 400 }
      ),
    }
  }

  if (!adminRecord) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: "Access denied. This account is not an admin." },
        { status: 403 }
      ),
    }
  }

  return {
    user,
    errorResponse: null,
  }
}

function envStatus(name: string, required: boolean, publicVariable = false) {
  const value = process.env[name]

  return {
    name,
    required,
    public: publicVariable,
    configured: Boolean(value && value.trim()),
  }
}

export async function GET(req: NextRequest) {
  try {
    const { errorResponse } = await requireAdmin(req)

    if (errorResponse) {
      return errorResponse
    }

    const variables = [
      envStatus("NEXT_PUBLIC_SUPABASE_URL", true, true),
      envStatus("NEXT_PUBLIC_SUPABASE_ANON_KEY", true, true),
      envStatus("SUPABASE_SERVICE_ROLE_KEY", true, false),
      envStatus("QWIKEER_DEV_TOOLS_ENABLED", true, false),
      envStatus("NEXT_PUBLIC_QWIKEER_DEV_TOOLS_ENABLED", true, true),
      envStatus("NEXT_PUBLIC_SITE_URL", false, true),
      envStatus("QWIKEER_ENVIRONMENT", false, false),
    ]

    const missingRequired = variables.filter(
      (item) => item.required && !item.configured
    )

    const devToolsValue = process.env.QWIKEER_DEV_TOOLS_ENABLED
    const publicDevToolsValue =
      process.env.NEXT_PUBLIC_QWIKEER_DEV_TOOLS_ENABLED
    const environment = process.env.QWIKEER_ENVIRONMENT || "not_set"

    /**
     * Database health check.
     *
     * This RPC is created by:
     * supabase/migrations/004_qwikeer_security_hardening.sql
     *
     * If it does not exist yet, we return a warning instead of crashing
     * the whole environment page.
     */
    let databaseHealth: {
      ok: boolean
      missing_tables: string[]
      rls_disabled_tables: string[]
      missing_functions: string[]
      error?: string | null
    } = {
      ok: false,
      missing_tables: [],
      rls_disabled_tables: [],
      missing_functions: [],
      error: null,
    }

    const { data: dbHealthData, error: dbHealthError } = await supabaseAdmin.rpc(
      "qwikeer_database_health_check"
    )

    if (dbHealthError) {
      databaseHealth = {
        ok: false,
        missing_tables: [],
        rls_disabled_tables: [],
        missing_functions: ["qwikeer_database_health_check"],
        error: dbHealthError.message,
      }
    } else {
      databaseHealth = {
        ok: Boolean(dbHealthData?.ok),
        missing_tables: Array.isArray(dbHealthData?.missing_tables)
          ? dbHealthData.missing_tables
          : [],
        rls_disabled_tables: Array.isArray(dbHealthData?.rls_disabled_tables)
          ? dbHealthData.rls_disabled_tables
          : [],
        missing_functions: Array.isArray(dbHealthData?.missing_functions)
          ? dbHealthData.missing_functions
          : [],
        error: null,
      }
    }

    const warnings = [
      ...(devToolsValue === "true"
        ? [
            "QWIKEER_DEV_TOOLS_ENABLED is true. Keep this only for local/development. Set it to false in production.",
          ]
        : []),
      ...(publicDevToolsValue === "true"
        ? [
            "NEXT_PUBLIC_QWIKEER_DEV_TOOLS_ENABLED is true. Dev-only UI buttons may be visible. Set it to false in production.",
          ]
        : []),
      ...(!process.env.NEXT_PUBLIC_SITE_URL
        ? [
            "NEXT_PUBLIC_SITE_URL is not set. Add it before production for consistent redirects and links.",
          ]
        : []),
      ...(databaseHealth.error
        ? [
            "Database health check RPC is missing or failed. Run/update 004_qwikeer_security_hardening.sql.",
          ]
        : []),
      ...(databaseHealth.rls_disabled_tables.length > 0
        ? [
            "Some required tables have RLS disabled. Review the database security migration.",
          ]
        : []),
      ...(databaseHealth.missing_tables.length > 0
        ? [
            "Some required database tables are missing. Review your migrations.",
          ]
        : []),
      ...(databaseHealth.missing_functions.length > 0
        ? [
            "Some required database functions are missing. Review your migrations.",
          ]
        : []),
    ]

    return NextResponse.json({
      ok: missingRequired.length === 0 && databaseHealth.ok,
      environment,
      devToolsEnabled: devToolsValue === "true",
      publicDevToolsEnabled: publicDevToolsValue === "true",
      variables,
      missingRequired,
      databaseHealth,
      warnings,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error"

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    )
  }
}