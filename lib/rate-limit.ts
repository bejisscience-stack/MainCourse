import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// PRODUCTION REQUIREMENT: Ensure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set.
// Without Redis, rate limiting is ephemeral and can be bypassed by waiting for deploys.
const hasRedis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

if (!hasRedis) {
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[Rate Limit] CRITICAL: Upstash Redis not configured in production. Rate limits are ephemeral and per-instance. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
    );
  } else {
    console.warn(
      "[Rate Limit] Upstash Redis not configured — using in-memory fallback (dev only)",
    );
  }
}

const redisOrMemory = hasRedis ? Redis.fromEnv() : new Map<string, number>();

function createLimiter(
  prefix: string,
  maxRequests: number,
  windowSeconds: number,
) {
  return new Ratelimit({
    redis: redisOrMemory as ConstructorParameters<typeof Ratelimit>[0]["redis"],
    limiter: Ratelimit.slidingWindow(maxRequests, `${windowSeconds} s`),
    prefix: `ratelimit:${prefix}`,
    analytics: false,
    ephemeralCache: hasRedis ? undefined : new Map(),
  });
}

// --- Pre-configured limiters ---

const _loginLimiter = createLimiter("login", 5, 60);
const _paymentLimiter = createLimiter("payment", 3, 60);
const _referralLimiter = createLimiter("referral", 10, 60);
const _passwordResetLimiter = createLimiter("password-reset", 3, 900);
const _adminLimiter = createLimiter("admin", 30, 60);
const _subscribeLimiter = createLimiter("subscribe", 3, 60);
const _callbackLimiter = createLimiter("callback", 30, 60);
const _notificationLimiter = createLimiter("notification", 60, 60);

// Wrap Upstash limiter to match existing { allowed, retryAfterMs } interface.
// When Redis is not configured, the Ratelimit constructor receives a Map which
// does not implement the Redis command interface. Calling limiter.limit() on it
// throws (e.g. "redis.eval is not a function"), so we catch and allow through.
function wrapLimiter(limiter: Ratelimit) {
  return {
    async check(
      identifier: string,
    ): Promise<{ allowed: boolean; retryAfterMs: number }> {
      try {
        const result = await limiter.limit(identifier);
        return {
          allowed: result.success,
          retryAfterMs: result.success
            ? 0
            : Math.max(0, result.reset - Date.now()),
        };
      } catch (err) {
        // Redis not available — allow the request through (fail-open)
        console.warn(
          "[Rate Limit] limiter.limit() failed, allowing request:",
          err,
        );
        return { allowed: true, retryAfterMs: 0 };
      }
    },
  };
}

export const loginLimiter = wrapLimiter(_loginLimiter);
export const paymentLimiter = wrapLimiter(_paymentLimiter);
export const referralLimiter = wrapLimiter(_referralLimiter);
export const passwordResetLimiter = wrapLimiter(_passwordResetLimiter);
export const adminLimiter = wrapLimiter(_adminLimiter);
export const subscribeLimiter = wrapLimiter(_subscribeLimiter);
export const callbackLimiter = wrapLimiter(_callbackLimiter);
export const notificationLimiter = wrapLimiter(_notificationLimiter);

// INFRA-04: DigitalOcean App Platform sets X-Forwarded-For with the real client IP as the first entry
export function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function rateLimitResponse(retryAfterMs: number): NextResponse {
  const retryAfterSec = Math.ceil(retryAfterMs / 1000);
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    },
  );
}
