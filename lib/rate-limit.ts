import { NextRequest, NextResponse } from "next/server"

/**
 * Simple in-memory rate limiter for Qwikeer.
 *
 * Good for:
 * - local development
 * - early testing
 * - basic abuse protection foundation
 *
 * Production note:
 * - In serverless production, memory is not shared between all instances.
 * - Later, replace this with Redis/Upstash or a database-backed limiter.
 */

type RateLimitOptions = {
  key: string
  limit: number
  windowMs: number
}

type RateLimitBucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, RateLimitBucket>()

function nowMs() {
  return Date.now()
}

/**
 * Get a safe IP-ish identifier.
 *
 * On Vercel/proxies:
 * - x-forwarded-for often contains the real client IP first.
 */
export function getRequestIp(req: NextRequest) {
  const forwardedFor = req.headers.get("x-forwarded-for")

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown"
  }

  const realIp = req.headers.get("x-real-ip")

  if (realIp) {
    return realIp
  }

  return "unknown"
}

/**
 * Build a stable key for user/IP/route.
 */
export function buildRateLimitKey(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(":")
}

/**
 * Checks and increments a bucket.
 */
export function checkRateLimit(options: RateLimitOptions) {
  const now = nowMs()
  const existing = buckets.get(options.key)

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + options.windowMs

    buckets.set(options.key, {
      count: 1,
      resetAt,
    })

    return {
      allowed: true,
      limit: options.limit,
      remaining: options.limit - 1,
      resetAt,
      retryAfterSeconds: 0,
    }
  }

  if (existing.count >= options.limit) {
    const retryAfterSeconds = Math.ceil((existing.resetAt - now) / 1000)

    return {
      allowed: false,
      limit: options.limit,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds,
    }
  }

  existing.count += 1
  buckets.set(options.key, existing)

  return {
    allowed: true,
    limit: options.limit,
    remaining: Math.max(options.limit - existing.count, 0),
    resetAt: existing.resetAt,
    retryAfterSeconds: 0,
  }
}

/**
 * Returns a JSON 429 response when blocked.
 */
export function rateLimitResponse(result: ReturnType<typeof checkRateLimit>) {
  return NextResponse.json(
    {
      error: "Too many requests. Please slow down and try again.",
      retryAfterSeconds: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(result.resetAt),
      },
    }
  )
}

/**
 * Convenience helper for API routes.
 */
export function enforceRateLimit(options: RateLimitOptions) {
  const result = checkRateLimit(options)

  if (!result.allowed) {
    return rateLimitResponse(result)
  }

  return null
}

/**
 * Optional cleanup to avoid memory growing forever in long-running dev server.
 */
export function cleanupExpiredRateLimitBuckets() {
  const now = nowMs()

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key)
    }
  }

  return {
    bucketsRemaining: buckets.size,
  }
}

/**
 * Debug/dev visibility.
 */
export function getRateLimitDebugStats() {
  return {
    buckets: buckets.size,
  }
}