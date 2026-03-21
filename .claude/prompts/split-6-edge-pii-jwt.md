# Agent 6 — Edge Function PII Removal + JWT Fallback Fix

**Priority:** HIGH
**Findings:** HIGH-09, HIGH-10

## Files to MODIFY

- `supabase/functions/validate-referral-code/index.ts` (HIGH-09)
- `supabase/functions/admin-enrollment-requests/index.ts` (HIGH-10)
- `supabase/functions/admin-withdrawals/index.ts` (HIGH-10)
- `supabase/functions/admin-bundle-enrollment-requests/index.ts` (HIGH-10)

## Files you MUST NOT touch

All other files. Especially NOT: `supabase/functions/notifications/index.ts`, `supabase/functions/notification-read/index.ts`, `supabase/functions/notifications-read-all/index.ts`, `supabase/functions/notifications-unread-count/index.ts`, `supabase/functions/balance/index.ts`, `supabase/functions/enrollment-requests/index.ts`, `supabase/functions/bundle-enrollment-requests/index.ts`, `supabase/functions/withdrawals/index.ts`, `supabase/functions/admin-enrollment-reject/index.ts`, `supabase/functions/admin-bundle-enrollment-reject/index.ts`, `supabase/functions/admin-notifications-send/index.ts`, `lib/rate-limit.ts`, `lib/email-templates.ts`, any `app/api/` files, any migration files.

## Task Part 1: Remove PII from validate-referral-code (HIGH-09)

Read `supabase/functions/validate-referral-code/index.ts` fully.

**Current problem:** The function queries `profiles` for `first_name, last_name` and returns `referrerName` in the response. This lets anyone enumerate referral codes and harvest real names.

**Fix:**

1. Remove `first_name` and `last_name` from the SELECT query — only select `referral_code` (or `id` if needed)
2. Remove the `referrerName` construction logic
3. Return only `{ valid: true }` without any PII

**BEFORE:**

```typescript
const { data: profile } = await supabase
  .from("profiles")
  .select("referral_code, first_name, last_name");
// ...

const referrerName = profile.first_name
  ? `${profile.first_name}${profile.last_name ? " " + profile.last_name.charAt(0) + "." : ""}`
  : undefined;

return jsonResponse({ valid: true, referrerName });
```

**AFTER:**

```typescript
const { data: profile } = await supabase
  .from("profiles")
  .select("referral_code");
// ...

return jsonResponse({ valid: true });
```

**Also check the Next.js API route** `app/api/validate-referral-code/route.ts` and `app/api/public/validate-referral-code/route.ts` — if they also return `referrerName`, that's handled by another agent or is out of scope. Just note it.

Wait — actually those API route files are NOT in your allowed files list. Just fix the edge function and note in the commit if the API routes also need the same fix.

## Task Part 2: Remove JWT fallback from admin edge functions (HIGH-10)

For each of the 3 admin edge functions:

Read the file and find the pattern:

```typescript
const serviceSupabase = createServiceRoleClient(token);
```

The `createServiceRoleClient` function in `_shared/supabase.ts` accepts a fallback token. The issue is that if the service role key env var is missing, it falls back to using the user's JWT token for service-role operations.

**Fix:** Change to pass NO fallback, so the function fails explicitly if the service role key is unavailable:

```typescript
const serviceSupabase = createServiceRoleClient();
```

If `createServiceRoleClient` requires a parameter, read `supabase/functions/_shared/supabase.ts` to understand the signature. The fix should ensure that:

- If `SUPABASE_SERVICE_ROLE_KEY` env var is available, it's used (this is the normal case)
- If it's NOT available, the function should fail with an error rather than silently using a user JWT

If `createServiceRoleClient` signature requires a token param, either:

1. Remove the fallback inside `createServiceRoleClient` (but only if this file is in your allowed list — it's NOT, so don't modify `_shared/supabase.ts`)
2. OR pass `undefined` or empty string and let it fail: `createServiceRoleClient()`

Read the actual `_shared/supabase.ts` to determine the correct approach. If you cannot fix this without modifying `_shared/supabase.ts`, just remove the `token` argument from the call and document what happens.

## Verification

Run `npm run build` to ensure no TypeScript compilation errors.

## Commit

```
fix: remove PII from validate-referral-code + remove JWT fallback in admin edge fns (HIGH-09, HIGH-10)
```

Output DONE when build passes.
