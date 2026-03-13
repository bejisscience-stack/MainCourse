# Agent 3: SEC-04 — Make Keepz IP allowlisting fail-closed (HIGH)

## Priority: P1 — HIGH

## Problem

The Keepz callback IP allowlist in `app/api/payments/keepz/callback/route.ts` is optional — if `KEEPZ_ALLOWED_IPS` env var is not set, the check is skipped entirely (fail-open). This should be fail-closed in production.

## Files to MODIFY

- `app/api/payments/keepz/callback/route.ts` (lines 36-49 only)

## Files NOT to touch (owned by other agents)

- `supabase/migrations/` (any file)
- `lib/rate-limit.ts`
- `lib/admin-auth.ts`
- `next.config.js`
- `app/api/notifications/` (any file)

## Implementation

In `app/api/payments/keepz/callback/route.ts`, replace lines 36-49 (the IP allowlist section) with fail-closed logic:

Replace this block:

```typescript
// IP allowlist check (graceful degradation: skip if not configured)
const allowedIPs = process.env.KEEPZ_ALLOWED_IPS;
if (allowedIPs) {
  const whitelist = allowedIPs.split(",").map((ip) => ip.trim());
  if (!whitelist.includes(clientIP)) {
    console.warn("[Keepz Callback] BLOCKED: IP not in allowlist", {
      ip: clientIP,
    });
    await auditLog(supabase, null, null, null, "callback_ip_blocked", {
      ip: clientIP,
    });
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
```

With:

```typescript
// IP allowlist check (fail-closed: block if not configured in production)
const allowedIPs = process.env.KEEPZ_ALLOWED_IPS;
if (!allowedIPs) {
  // In production, KEEPZ_ALLOWED_IPS must be set — reject all callbacks without it
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[Keepz Callback] BLOCKED: KEEPZ_ALLOWED_IPS not configured in production",
    );
    await auditLog(supabase, null, null, null, "callback_ip_no_allowlist", {
      ip: clientIP,
    });
    return NextResponse.json({ received: true }, { status: 200 });
  }
  // In development, warn but allow
  console.warn(
    "[Keepz Callback] WARNING: KEEPZ_ALLOWED_IPS not set, skipping IP check (dev only)",
  );
} else {
  const whitelist = allowedIPs.split(",").map((ip) => ip.trim());
  if (!whitelist.includes(clientIP)) {
    console.warn("[Keepz Callback] BLOCKED: IP not in allowlist", {
      ip: clientIP,
    });
    await auditLog(supabase, null, null, null, "callback_ip_blocked", {
      ip: clientIP,
    });
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
```

## Verification

Run `npm run build`. Commit with message `security: make Keepz IP allowlisting fail-closed in production (SEC-04)`. Output DONE when build passes.
