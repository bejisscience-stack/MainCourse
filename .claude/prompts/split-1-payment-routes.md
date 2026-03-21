# Split 1: Payment Route Security (SEC-02, SEC-10, SEC-25)

## Scope

Fix security issues in payment API routes. You ONLY touch files listed below.

## Files to Modify

- `app/api/payments/keepz/callback/route.ts`
- `app/api/payments/keepz/create-order/route.ts`
- `app/api/payments/keepz/verify-pending/route.ts`
- `app/api/payments/keepz/status/route.ts`

## DO NOT Touch

- `lib/rate-limit.ts` (Agent 2)
- `lib/supabase-server.ts` (Agent 2)
- `middleware.ts` (Agent 7)
- Any `supabase/migrations/` files (Agents 3-5)
- Any other `app/api/` routes (Agent 6)
- Any `supabase/functions/` files (Agent 7)

## Fixes

### SEC-02: Remove stack traces from payment_audit_log (CRITICAL)

**File:** `app/api/payments/keepz/callback/route.ts`

In the catch block at the bottom of the POST handler (~line 345-354), remove `stack` from both the console.error and the auditLog call. Replace with a hash for dedup:

```typescript
// BEFORE (around line 345-354):
console.error("[Keepz Callback] Unhandled error:", {
  timestamp: new Date().toISOString(),
  error: String(error),
  stack: error instanceof Error ? error.stack : undefined,
});
await auditLog(supabase, null, null, null, "callback_unhandled_error", {
  error: String(error),
  stack: error instanceof Error ? error.stack : undefined,
});

// AFTER:
console.error("[Keepz Callback] Unhandled error:", String(error));
if (process.env.NODE_ENV !== "production" && error instanceof Error) {
  console.error(error.stack);
}
await auditLog(supabase, null, null, null, "callback_unhandled_error", {
  error: String(error),
});
```

### SEC-10: Make Keepz IP allowlist mandatory in production (HIGH)

**File:** `app/api/payments/keepz/callback/route.ts`

In the IP allowlist section (~line 36-66), make it mandatory in production:

```typescript
// BEFORE (around line 51-65):
} else {
  console.warn(
    "[Keepz Callback] KEEPZ_ALLOWED_IPS not set — relying on encrypted payload auth",
    { ip: clientIP },
  );
  await auditLog(supabase, null, null, null, "callback_ip_allowlist_missing", {
    ip: clientIP,
  });
}

// AFTER:
} else {
  if (process.env.NODE_ENV === "production") {
    console.error("[Keepz Callback] FATAL: KEEPZ_ALLOWED_IPS not configured in production");
    await auditLog(supabase, null, null, null, "callback_ip_allowlist_missing", {
      ip: clientIP,
    });
    return NextResponse.json({ received: true }, { status: 200 });
  }
  console.warn("[Keepz Callback] KEEPZ_ALLOWED_IPS not set — dev mode, proceeding");
}
```

### SEC-02 (continued): Remove stack traces from other payment routes

**File:** `app/api/payments/keepz/create-order/route.ts` (~line 219)
Remove `stack: verifyErr instanceof Error ? verifyErr.stack : undefined,` from the audit log call.

**File:** `app/api/payments/keepz/verify-pending/route.ts` (~line 148)
Remove `stack: err instanceof Error ? err.stack : undefined,` from the audit log call.

**File:** `app/api/payments/keepz/status/route.ts` (~lines 185-186)
Remove `stack: verifyError instanceof Error ? verifyError.stack : undefined,` from the audit log call.

In all 3 files, remove the `stack:` property from the audit log object. Keep `error: String(error)` only.

### SEC-25: Use NEXT_PUBLIC_APP_URL instead of x-forwarded headers (MEDIUM)

**File:** `app/api/payments/keepz/create-order/route.ts`

Find the section using `x-forwarded-host` and `x-forwarded-proto` (~line 269-271) and replace:

```typescript
// BEFORE:
const forwardedHost =
  request.headers.get("x-forwarded-host") || request.headers.get("host");
const forwardedProto = request.headers.get("x-forwarded-proto") || "https";

// AFTER:
const appUrl = process.env.NEXT_PUBLIC_APP_URL;
```

Then update wherever `forwardedHost` and `forwardedProto` are used to construct URLs — use `appUrl` directly instead of `${forwardedProto}://${forwardedHost}`. Read the surrounding code to understand the URL construction and adjust accordingly.

## Completion

Run `npm run build`. If it passes, commit with message:

```
fix(security): harden payment routes — remove stack traces, enforce IP allowlist, use app URL

SEC-02: Remove error.stack from payment_audit_log entries
SEC-10: Block Keepz callbacks in production when KEEPZ_ALLOWED_IPS not set
SEC-25: Use NEXT_PUBLIC_APP_URL instead of trusting x-forwarded headers
```

Output DONE when build passes.
