# Agent 5: SEC-12 — Migrate notification routes from service-role to user-scoped client (LOW)

## Priority: P4 — Defense-in-depth

## Problem

Three notification routes use `createServiceRoleClient()` which bypasses all RLS policies. While all queries are correctly scoped by `user_id`, this reduces defense-in-depth. These routes should use `createServerSupabaseClient(token)` which respects RLS.

## Files to MODIFY

- `app/api/notifications/read-all/route.ts`
- `app/api/notifications/[id]/read/route.ts`
- `app/api/notifications/unread-count/route.ts`

## Files NOT to touch (owned by other agents)

- `supabase/migrations/` (any file)
- `app/api/payments/keepz/callback/route.ts`
- `lib/rate-limit.ts`
- `lib/admin-auth.ts`
- `next.config.js`
- `app/api/notifications/route.ts` (already uses correct client)
- `app/api/notifications/test-email/route.ts` (no Supabase client)

## PREREQUISITE CHECK

Before modifying these routes, verify that the `notifications` table has SELECT and UPDATE RLS policies that allow users to read/update their own notifications. Check the migrations:

```bash
grep -r "notifications" supabase/migrations/ --include="*.sql" -l
```

Read the relevant migration to confirm RLS policies exist for user-scoped access. If no RLS policy allows `auth.uid() = user_id` for SELECT and UPDATE on `notifications`, then DO NOT make these changes — service role is currently required. Instead, just output "SKIPPED: No user-scoped RLS policies on notifications table" and commit nothing.

## Implementation (only if RLS policies exist)

### File 1: `app/api/notifications/unread-count/route.ts`

Replace import:

```typescript
import {
  createServiceRoleClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
```

With:

```typescript
import {
  createServerSupabaseClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
```

Replace line 25:

```typescript
const supabase = createServiceRoleClient(token);
```

With:

```typescript
const supabase = createServerSupabaseClient(token);
```

Remove the comment on line 24 about bypassing RLS.

### File 2: `app/api/notifications/read-all/route.ts`

Same pattern — replace `createServiceRoleClient` import and usage with `createServerSupabaseClient`.

Replace import:

```typescript
import {
  createServiceRoleClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
```

With:

```typescript
import {
  createServerSupabaseClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
```

Replace line 24:

```typescript
const supabase = createServiceRoleClient(token);
```

With:

```typescript
const supabase = createServerSupabaseClient(token);
```

Remove the comment on line 23 about bypassing RLS.

### File 3: `app/api/notifications/[id]/read/route.ts`

Same pattern.

Replace import:

```typescript
import {
  createServiceRoleClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
```

With:

```typescript
import {
  createServerSupabaseClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
```

Replace line 35:

```typescript
const supabase = createServiceRoleClient(token);
```

With:

```typescript
const supabase = createServerSupabaseClient(token);
```

Remove the comment on line 34 about bypassing RLS.

## Verification

Run `npm run build`. Commit with message `security: use user-scoped Supabase client in notification routes (SEC-12)`. Output DONE when build passes.
