# Agent 1: Fix rate-limit module-level throw (ROOT CAUSE of all 4 bugs)

## Problem

`lib/rate-limit.ts` lines 10-24 throw at module level in production when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are not set. This prevents **every API route** that imports `rate-limit.ts` (directly or via `lib/audit-log.ts`) from loading. When a route module fails to load, Next.js returns a 500 HTML error page instead of JSON.

### Affected routes (all 4 bugs):

- `app/api/complete-profile/route.ts` — imports `rate-limit.ts` directly
- `app/api/admin/lecturer-approvals/route.ts` — imports `audit-log.ts` → imports `rate-limit.ts`
- `app/api/admin/withdrawals/route.ts` — imports `audit-log.ts` → imports `rate-limit.ts`
- `app/api/admin/notifications/send/route.ts` — imports `audit-log.ts` → imports `rate-limit.ts`

## Fix

In `lib/rate-limit.ts`, replace the module-level `throw` (lines 10-24) with a warning log. The fail-closed behavior is **already implemented** in `wrapLimiter`'s catch block (lines 70-77), which denies requests when Redis calls fail. The module-level throw is redundant and harmful.

### Before (lines 10-24):

```typescript
if (!hasRedis) {
  // SEC-06: crash-fast in production runtime (skip during next build)
  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    throw new Error(
      "[Rate Limit] CRITICAL: Upstash Redis not configured in production. Rate limits are ephemeral and per-instance. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
    );
  } else if (process.env.NODE_ENV !== "production") {
    console.warn(
      "[Rate Limit] Upstash Redis not configured — using in-memory fallback (dev only)",
    );
  }
}
```

### After:

```typescript
if (!hasRedis) {
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[Rate Limit] CRITICAL: Upstash Redis not configured in production. " +
        "Rate limiting will fail-closed (all rate-limited requests denied). " +
        "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
    );
  } else {
    console.warn(
      "[Rate Limit] Upstash Redis not configured — using in-memory fallback (dev only)",
    );
  }
}
```

This preserves the security intent (fail-closed) because `wrapLimiter` already denies requests when Redis is unavailable, but routes still load and return proper JSON error responses.

## Files to modify

- `lib/rate-limit.ts` — ONLY this file

## Files NOT to touch (owned by Agent 2)

- `hooks/useAdminWithdrawalRequests.ts`
- `app/complete-profile/page.tsx`
- `components/AdminNotificationSender.tsx`

## Verification

Run `npm run build`. Commit with message "fix: remove rate-limit module-level throw — routes return JSON errors instead of crashing". Output DONE when build passes.
