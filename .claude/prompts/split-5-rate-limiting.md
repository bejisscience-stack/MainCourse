# Agent 5 — Rate Limiting Additions

**Priority:** HIGH + MEDIUM
**Findings:** HIGH-05, HIGH-06, MED-03, MED-04, MED-05, MED-06, MED-07

## Files to MODIFY

- `lib/rate-limit.ts` (add new limiters)
- `app/api/enrollment-requests/route.ts` (HIGH-05)
- `app/api/withdrawals/route.ts` (HIGH-06)
- `app/api/balance/route.ts` (MED-03 — PATCH only)
- `app/api/profile/route.ts` (MED-04 — PATCH only)
- `app/api/complete-profile/route.ts` (MED-05)
- `app/api/account/delete/route.ts` (MED-06)
- `app/api/payments/keepz/status/route.ts` (MED-07)

## Files you MUST NOT touch

All other files. Especially NOT: `app/api/payments/keepz/create-order/route.ts`, `app/api/admin/*`, any `supabase/functions/`, `lib/email-templates.ts`, `components/*`, any migration files.

## Existing Pattern

From `lib/rate-limit.ts`, limiters are created with:

```typescript
function createLimiter(
  prefix: string,
  maxRequests: number,
  windowSeconds: number,
);
```

Existing exports: `paymentLimiter`, `loginLimiter`, `referralLimiter`, `passwordResetLimiter`, `adminLimiter`, `subscribeLimiter`, `callbackLimiter`, `notificationLimiter`.

Usage pattern in API routes:

```typescript
import { someNewLimiter, rateLimitResponse } from "@/lib/rate-limit";

// Inside the handler, after auth:
const { allowed, retryAfterMs } = await someNewLimiter.check(user.id);
if (!allowed) return rateLimitResponse(retryAfterMs);
```

## Task

### Step 1: Add new limiters to `lib/rate-limit.ts`

```typescript
// General-purpose limiter for standard authenticated endpoints
export const generalLimiter = createLimiter("general", 30, 60);

// Stricter limiter for sensitive write operations
export const writeLimiter = createLimiter("write", 10, 60);

// Account operations (delete, profile changes)
export const accountLimiter = createLimiter("account", 5, 60);
```

### Step 2: Add rate limiting to each route

For each file, read it completely first, then add the rate limiting check AFTER authentication but BEFORE any business logic.

**`app/api/enrollment-requests/route.ts`** (HIGH-05):

- POST handler: Add `writeLimiter.check(user.id)` after auth
- GET handler: Add `generalLimiter.check(user.id)` after auth

**`app/api/withdrawals/route.ts`** (HIGH-06):

- POST handler: Add `paymentLimiter.check(user.id)` after auth (reuse existing paymentLimiter — withdrawals are financial)
- GET handler: Add `generalLimiter.check(user.id)` after auth

**`app/api/balance/route.ts`** (MED-03):

- PATCH handler: Add `accountLimiter.check(user.id)` after auth
- GET handler: no change needed (low risk read)

**`app/api/profile/route.ts`** (MED-04):

- PATCH handler: Add `accountLimiter.check(user.id)` after auth
- GET handler: no change needed (low risk read)

**`app/api/complete-profile/route.ts`** (MED-05):

- POST handler: Add `accountLimiter.check(user.id)` after auth

**`app/api/account/delete/route.ts`** (MED-06):

- DELETE handler: Add `accountLimiter.check(user.id)` after auth

**`app/api/payments/keepz/status/route.ts`** (MED-07):

- GET handler: Add `generalLimiter.check(user.id)` after auth

### Import pattern for each route file

Add to existing imports:

```typescript
import { generalLimiter, rateLimitResponse } from "@/lib/rate-limit";
// or writeLimiter, paymentLimiter, accountLimiter as appropriate
```

### Code insertion pattern

After the auth check (typically after `const user = await verifyTokenAndGetUser(token)`), add:

```typescript
const { allowed, retryAfterMs } = await writeLimiter.check(user.id);
if (!allowed) return rateLimitResponse(retryAfterMs);
```

## Verification

Run `npm run build` to ensure no TypeScript compilation errors.

## Commit

```
fix: add rate limiting to 7 unprotected API routes (HIGH-05, HIGH-06, MED-03-07)
```

Output DONE when build passes.
