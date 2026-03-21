# Split 7: Edge Functions + Middleware (SEC-26, SEC-29, SEC-35, SEC-02-edge)

## Scope

Fix security issues in edge functions and middleware. You ONLY touch files listed below.

## Files to Modify

- `supabase/functions/_shared/auth.ts`
- `supabase/functions/chat-messages/index.ts`
- `supabase/functions/enrollment-requests/index.ts`
- `supabase/functions/bundle-enrollment-requests/index.ts`
- `middleware.ts`

## DO NOT Touch

- `app/api/payments/` (Agent 1)
- `lib/rate-limit.ts` (Agent 2)
- `lib/supabase-server.ts` (Agent 2)
- Any `supabase/migrations/` files (Agents 3-5)
- Any `app/api/` routes (Agent 6)
- `supabase/functions/admin-withdrawal-approve/` (no changes needed)

## Fixes

### SEC-26: Fix token format validation in shared auth (MEDIUM)

**File:** `supabase/functions/_shared/auth.ts`

Find the token extraction (~line 46) that uses `replace("Bearer ", "")`. Add empty-string check:

```typescript
// AFTER the replace:
const token = authHeader.replace("Bearer ", "").trim();
if (!token || token.length === 0) {
  // Return appropriate error response for empty token
}
```

Read the file first to understand the full context and error response pattern, then add the check.

### SEC-29: Add server-side HTML sanitization for chat messages (MEDIUM)

**File:** `supabase/functions/chat-messages/index.ts`

Find where message content is validated for length (~line 24-47). Add basic HTML entity encoding as defense-in-depth:

```typescript
// After length validation, before inserting:
// Strip HTML tags as defense-in-depth (React escapes on frontend, but protect non-React consumers)
const sanitizedContent = content
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#x27;");
// Use sanitizedContent instead of content for the insert
```

Read the file first to understand the exact flow and where to insert this.

### SEC-02-edge: Remove stack traces from edge function error responses

**Files:**

- `supabase/functions/enrollment-requests/index.ts` (~line 271)
- `supabase/functions/bundle-enrollment-requests/index.ts` (~line 217)

Both files return `error.stack` in error response bodies. Replace with a generic message:

```typescript
// BEFORE:
details: error instanceof Error ? error.stack : 'An unexpected error occurred',

// AFTER:
details: 'An unexpected error occurred',
```

The stack trace should only go to console (which is server-side logs), not in the HTTP response body.

### SEC-35: Restrict CSP img-src to project-specific Supabase domains (LOW)

**File:** `middleware.ts`

Find the CSP `img-src` directive (~line 100). Replace the wildcard:

```typescript
// BEFORE:
// img-src ... https://*.supabase.co ...

// AFTER:
// img-src ... https://bvptqdmhuumjbyfnjxdt.supabase.co https://nbecbsbuerdtakxkrduw.supabase.co ...
```

Read the file first to find the exact CSP construction and modify only the `img-src` directive.

## Completion

Run `npm run build`. If it passes, commit with message:

```
fix(security): edge functions + middleware — token validation, sanitization, CSP

SEC-26: Add empty-token check after Bearer prefix removal
SEC-29: Add HTML entity encoding for chat messages (defense-in-depth)
SEC-02: Remove stack traces from edge function error responses
SEC-35: Restrict CSP img-src to project-specific Supabase domains
```

Output DONE when build passes.
