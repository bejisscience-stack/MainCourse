# Agent 2: SEC-03 — Restrict referrals INSERT policy (HIGH)

## Priority: P1 — HIGH

## Problem

The `"System can insert referrals"` RLS policy uses `WITH CHECK (true)`, allowing ANY authenticated user to insert arbitrary referral records directly into the `referrals` table, bypassing the `process_referral()` SECURITY DEFINER function.

## Files to CREATE

- `supabase/migrations/131_restrict_referrals_insert.sql`

## Files NOT to touch (owned by other agents)

- `supabase/migrations/130_fix_chat_media_select_policy.sql`
- `app/api/payments/keepz/callback/route.ts`
- `lib/rate-limit.ts`
- `lib/admin-auth.ts`
- `next.config.js`
- `app/api/notifications/` (any file)

## Implementation

Create `supabase/migrations/131_restrict_referrals_insert.sql` with:

```sql
-- SEC-03: Restrict referrals INSERT policy
-- The original policy (migration 064) used WITH CHECK (true), allowing any
-- authenticated user to insert arbitrary referral records.
-- Restrict to: user can only create referrals where they are the referred user.
-- The process_referral() SECURITY DEFINER function (which bypasses RLS) remains
-- the primary insertion method with full validation.

DROP POLICY IF EXISTS "System can insert referrals" ON public.referrals;

CREATE POLICY "Users can insert own referrals"
  ON public.referrals FOR INSERT
  WITH CHECK (auth.uid() = referred_user_id);
```

## Verification

Run `npm run build`. Commit with message `security: restrict referrals INSERT RLS policy (SEC-03)`. Output DONE when build passes.
