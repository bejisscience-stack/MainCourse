# Split 2: Rate Limiting + Server Hardening (SEC-06, SEC-07, SEC-17)

## Scope

Harden rate limiting and Supabase server client initialization. You ONLY touch files listed below.

## Files to Modify

- `lib/rate-limit.ts`
- `lib/supabase-server.ts`

## DO NOT Touch

- `app/api/payments/` (Agent 1)
- `middleware.ts` (Agent 7)
- Any `supabase/migrations/` files (Agents 3-5)
- Any other `app/api/` routes (Agent 6)
- Any `supabase/functions/` files (Agent 7)

## Fixes

### SEC-06: Throw if Redis not configured in production (CRITICAL)

**File:** `lib/rate-limit.ts`

At the top of the file where `hasRedis` is checked and the in-memory fallback is created (~line 10-19), add a production guard:

```typescript
// AFTER hasRedis check:
if (!hasRedis && process.env.NODE_ENV === "production") {
  throw new Error(
    "FATAL: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production. " +
      "Rate limiting without Redis is unsafe in multi-instance deployments.",
  );
}
```

Keep the in-memory fallback for development only.

### SEC-17: Fail-closed for payment/auth endpoints on Redis outage (MEDIUM)

**File:** `lib/rate-limit.ts`

Find the catch block in the rate limiter check function (~line 66-72) that returns `{ allowed: true }` on error:

```typescript
// BEFORE:
catch (err) {
  return { allowed: true, retryAfterMs: 0 };
}

// AFTER:
catch (err) {
  console.error("[Rate Limit] Redis error, failing closed:", err);
  return { allowed: false, retryAfterMs: 60000 };
}
```

This makes rate limiting fail-closed: if Redis is down, deny the request rather than allowing unlimited access.

### SEC-07: Warn loudly when service role falls back to anon key (CRITICAL)

**File:** `lib/supabase-server.ts`

Find the section where dev falls back to anon key (~line 24-76). Add a prominent console warning:

```typescript
// In the dev fallback section, before returning the anon key client:
console.warn(
  "\n⚠️  WARNING: SUPABASE_SERVICE_ROLE_KEY is missing!\n" +
    "   Falling back to anon key — admin operations will fail silently.\n" +
    "   Set SUPABASE_SERVICE_ROLE_KEY in .env.local to match production behavior.\n",
);
```

## Completion

Run `npm run build`. If it passes, commit with message:

```
fix(security): harden rate limiting and server client initialization

SEC-06: Throw if Redis not configured in production (prevents in-memory fallback)
SEC-07: Add loud warning when service role key missing in dev
SEC-17: Rate limiter fails closed on Redis outage instead of allowing all requests
```

Output DONE when build passes.
