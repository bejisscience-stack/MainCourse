// TODO: In-memory store resets on deploy. Migrate to Upstash Redis when scaling to multiple instances. See SECURITY_AUDIT.md RL-01
import { NextRequest, NextResponse } from "next/server";

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimiterConfig {
  windowMs: number;
  maxRequests: number;
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private windowMs: number;
  private maxRequests: number;
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(config: RateLimiterConfig) {
    this.windowMs = config.windowMs;
    this.maxRequests = config.maxRequests;
    // Clean up expired entries every 60 seconds
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
    // Allow garbage collection of the interval
    if (this.cleanupInterval.unref) this.cleanupInterval.unref();
  }

  check(key: string): { allowed: boolean; retryAfterMs: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry) {
      this.store.set(key, { timestamps: [now] });
      return { allowed: true, retryAfterMs: 0 };
    }

    // Filter to only timestamps within the window
    entry.timestamps = entry.timestamps.filter((t) => now - t < this.windowMs);

    if (entry.timestamps.length >= this.maxRequests) {
      const oldest = entry.timestamps[0];
      const retryAfterMs = this.windowMs - (now - oldest);
      return { allowed: false, retryAfterMs };
    }

    entry.timestamps.push(now);
    return { allowed: true, retryAfterMs: 0 };
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      entry.timestamps = entry.timestamps.filter(
        (t) => now - t < this.windowMs,
      );
      if (entry.timestamps.length === 0) {
        this.store.delete(key);
      }
    }
  }
}

// Pre-configured limiters
export const loginLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 5,
});
export const paymentLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 3,
});
export const referralLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 10,
});
export const passwordResetLimiter = new RateLimiter({
  windowMs: 900_000,
  maxRequests: 3,
});
export const adminLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 30,
});
export const subscribeLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 3,
});

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
