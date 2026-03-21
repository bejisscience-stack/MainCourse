# Agent 3 — Edge Function CORS Fixes

**Priority:** HIGH
**Finding:** HIGH-03

## Files to MODIFY

- `supabase/functions/notifications/index.ts`
- `supabase/functions/notification-read/index.ts`
- `supabase/functions/notifications-read-all/index.ts`
- `supabase/functions/notifications-unread-count/index.ts`
- `supabase/functions/balance/index.ts`

## Files you MUST NOT touch

All other files. Especially NOT: `supabase/functions/enrollment-requests/index.ts`, `supabase/functions/withdrawals/index.ts`, `supabase/functions/bundle-enrollment-requests/index.ts`, `supabase/functions/health/index.ts`, `supabase/functions/chat-media/index.ts`, `supabase/functions/admin-*`, `supabase/functions/validate-referral-code/index.ts`, `lib/rate-limit.ts`, any `app/api/` files.

## The Correct CORS Pattern

From `supabase/functions/_shared/cors.ts`, the correct pattern is:

```typescript
import {
  handleCors,
  getCorsHeaders,
  jsonResponse,
  errorResponse,
} from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  // 1. Handle preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // 2. Get CORS headers for all subsequent responses
  const cors = getCorsHeaders(req);

  // 3. Use cors in EVERY response
  return jsonResponse({ data }, 200, cors);
  // or
  return errorResponse("Error message", 500, cors);
});
```

## Task

For each of the 5 files listed above:

1. Read the file completely
2. Ensure `getCorsHeaders` is imported (it may already import `handleCors` and `jsonResponse` but miss `getCorsHeaders` or `errorResponse`)
3. Ensure `const cors = getCorsHeaders(req)` is called after the preflight check
4. Find EVERY `return jsonResponse(...)` and `return errorResponse(...)` call and ensure the `cors` headers object is passed as the last parameter
5. Also check any raw `return new Response(...)` calls and add CORS headers

### Specific Issues Per File

**notifications/index.ts**: The `corsResponse = handleCors(req)` call exists but `cors` headers are NOT passed to error responses or success responses in all code paths. Thread `cors` through every response.

**notification-read/index.ts, notifications-read-all/index.ts, notifications-unread-count/index.ts**: Similar pattern — CORS preflight is handled but response paths don't pass CORS headers.

**balance/index.ts**: Success responses have CORS but error responses are missing CORS headers. Ensure ALL error paths include CORS.

## Verification

Run `npm run build` to ensure no TypeScript compilation errors.

## Commit

```
fix: thread CORS headers through all response paths in 5 edge functions (HIGH-03)
```

Output DONE when build passes.
