# Agent 4: SEC-05 + SEC-11 + SEC-02 partial — Misc security hardening (MEDIUM/LOW)

## Priority: P2-P4

## Files to MODIFY

- `lib/rate-limit.ts` (SEC-05)
- `lib/admin-auth.ts` (SEC-11)
- `next.config.js` (SEC-02 partial)

## Files NOT to touch (owned by other agents)

- `supabase/migrations/` (any file)
- `app/api/payments/keepz/callback/route.ts`
- `app/api/notifications/` (any file)

---

## Task 1: SEC-05 — Add production Redis enforcement (lib/rate-limit.ts)

In `lib/rate-limit.ts`, add a production enforcement check. Replace lines 10-14:

```typescript
if (!hasRedis) {
  console.warn(
    "[Rate Limit] WARNING: Upstash Redis not configured. Using in-memory fallback. Rate limits reset on deploy and are per-instance. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for persistent rate limiting.",
  );
}
```

With:

```typescript
if (!hasRedis) {
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[Rate Limit] CRITICAL: Upstash Redis not configured in production. Rate limits are ephemeral and per-instance. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN immediately.",
    );
  } else {
    console.warn(
      "[Rate Limit] WARNING: Upstash Redis not configured. Using in-memory fallback (dev only).",
    );
  }
}
```

---

## Task 2: SEC-11 — Use generic error message (lib/admin-auth.ts)

In `lib/admin-auth.ts`, replace both instances of:

```typescript
{
  error: "Access denied. Admin only.";
}
```

With:

```typescript
{
  error: "Access denied";
}
```

There are two occurrences: line 46 and line 52. Replace both.

---

## Task 3: SEC-02 partial — Narrow remotePatterns (next.config.js)

In `next.config.js`, replace lines 21-24:

```javascript
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.supabase.in" },
    ],
```

With narrowed hostnames for the specific Supabase projects:

```javascript
    remotePatterns: [
      { protocol: "https", hostname: "bvptqdmhuumjbyfnjxdt.supabase.co" },
      { protocol: "https", hostname: "nbecbsbuerdtakxkrduw.supabase.co" },
    ],
```

These are the staging and production project hostnames respectively.

---

## Verification

Run `npm run build`. Commit with message `security: harden rate-limit, admin errors, and image remotePatterns (SEC-02/05/11)`. Output DONE when build passes.
