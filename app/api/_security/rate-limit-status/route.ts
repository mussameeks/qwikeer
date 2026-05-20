import { NextResponse } from "next/server"
import {
  cleanupExpiredRateLimitBuckets,
  getRateLimitDebugStats,
} from "@/lib/rate-limit"

/**
 * GET /api/_security/rate-limit-status
 *
 * Dev-only debug endpoint to confirm rate limiter is active.
 *
 * Production safety:
 * - This route only works when QWIKEER_DEV_TOOLS_ENABLED=true.
 * - It does not expose user data or secrets.
 */

function devToolsEnabled() {
  return process.env.QWIKEER_DEV_TOOLS_ENABLED === "true"
}

export async function GET() {
  if (!devToolsEnabled()) {
    return NextResponse.json(
      {
        error: "Development security debug tools are disabled.",
      },
      { status: 403 }
    )
  }

  const cleanup = cleanupExpiredRateLimitBuckets()
  const stats = getRateLimitDebugStats()

  return NextResponse.json({
    ok: true,
    stats,
    cleanup,
  })
}