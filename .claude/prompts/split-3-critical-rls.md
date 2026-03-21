# Split 3: Critical RLS Migrations (SEC-01, SEC-03, SEC-05, SEC-30)

## Scope

Create new SQL migration files to fix critical RLS policies. You ONLY create NEW files listed below.

## Files to Create

- `supabase/migrations/146_fix_referrals_rls.sql`
- `supabase/migrations/147_fix_notifications_rls.sql`
- `supabase/migrations/148_fix_keepz_double_credit.sql`

## DO NOT Touch

- Any existing migration files
- Migration numbers 149-155 (reserved for other agents)
- Any TypeScript files
- Any files outside `supabase/migrations/`

## Fixes

### SEC-01: Fix referrals INSERT policy (CRITICAL)

**File:** `supabase/migrations/146_fix_referrals_rls.sql`

The current policy allows ANY authenticated user to insert referrals. Fix by:

1. Drop the existing `"System can insert referrals"` policy
2. Create a new policy with `WITH CHECK (false)` — block direct inserts
3. Create a `SECURITY DEFINER` function `create_referral_safe(p_referrer_id UUID, p_referred_id UUID, p_referral_code TEXT)` that:
   - Validates the referral code exists in profiles
   - Prevents self-referrals (`p_referrer_id != p_referred_id`)
   - Checks no existing referral for that referred user
   - Inserts the record
   - Returns success/failure

```sql
-- Migration: Fix referrals RLS - block direct inserts, use SECURITY DEFINER function

-- Drop the overly permissive INSERT policy
DROP POLICY IF EXISTS "System can insert referrals" ON public.referrals;

-- Block all direct inserts via RLS
CREATE POLICY "No direct referral inserts"
  ON public.referrals FOR INSERT
  WITH CHECK (false);

-- Create safe insert function
CREATE OR REPLACE FUNCTION public.create_referral_safe(
  p_referrer_id UUID,
  p_referred_id UUID,
  p_referral_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code_owner UUID;
BEGIN
  -- Prevent self-referrals
  IF p_referrer_id = p_referred_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'self_referral');
  END IF;

  -- Validate referral code exists and belongs to referrer
  SELECT id INTO v_code_owner
  FROM public.profiles
  WHERE referral_code = p_referral_code AND id = p_referrer_id;

  IF v_code_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;

  -- Check no existing referral for this referred user
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_id = p_referred_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_referred');
  END IF;

  -- Insert the referral
  INSERT INTO public.referrals (referrer_id, referred_id, referral_code)
  VALUES (p_referrer_id, p_referred_id, p_referral_code);

  RETURN jsonb_build_object('success', true);
END;
$$;
```

### SEC-03 + SEC-30: Fix notifications RLS policies (CRITICAL)

**File:** `supabase/migrations/147_fix_notifications_rls.sql`

1. Drop the overly permissive `"Service role full access"` policy
2. Add a scoped INSERT-only policy for service role (system notifications)
3. Add explicit UPDATE policy (users can only mark their own as read)
4. Add explicit DELETE policy (block all deletes — notifications are audit trail)

```sql
-- Migration: Fix notifications RLS - remove service role full access, add scoped policies

-- Drop overly permissive service role policy
DROP POLICY IF EXISTS "Service role full access" ON public.notifications;

-- Service role can only INSERT notifications (system-generated)
CREATE POLICY "Service role can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Service role can SELECT all notifications (for admin dashboards)
CREATE POLICY "Service role can read notifications"
  ON public.notifications FOR SELECT
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Users can only update their own notifications (mark as read)
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Block all direct deletes (notifications are audit trail)
DROP POLICY IF EXISTS "No notification deletes" ON public.notifications;
CREATE POLICY "No notification deletes"
  ON public.notifications FOR DELETE
  USING (false);
```

### SEC-05: Fix double-credit in complete_keepz_payment (CRITICAL)

**File:** `supabase/migrations/148_fix_keepz_double_credit.sql`

First, read `supabase/migrations/142_keepz_commission_deduction.sql` to understand the current `complete_keepz_payment()` function. Then create a new migration that recreates the function with a status check.

The key fix: add `AND status = 'pending'` to the enrollment_requests UPDATE, and check the row count. If 0 rows updated, the enrollment was already processed — skip balance credit and return `already_completed`.

```sql
-- Migration: Fix double-credit vulnerability in complete_keepz_payment
-- Add status = 'pending' check before updating enrollment_requests

-- Read the existing function from migration 142, then recreate it with the fix.
-- The critical change is in the UPDATE enrollment_requests statement.
-- You MUST read migration 142 first to get the full function body, then:
-- 1. Add WHERE ... AND status = 'pending' to the enrollment_requests UPDATE
-- 2. Check GET DIAGNOSTICS row_count after the UPDATE
-- 3. If row_count = 0, set result to 'already_completed' and RETURN (skip balance credit)
-- 4. Same fix for bundle_enrollment_requests if applicable
```

**IMPORTANT:** You MUST read `supabase/migrations/142_keepz_commission_deduction.sql` fully before writing this migration. Copy the entire `complete_keepz_payment` function and modify it with the status check fix. Do NOT write a partial function.

## Completion

Run `npm run build`. If it passes, commit with message:

```
fix(security): critical RLS fixes — referrals, notifications, double-credit

SEC-01: Block direct referral inserts, use SECURITY DEFINER function
SEC-03: Remove service role full access on notifications, scope to INSERT+SELECT only
SEC-05: Add status='pending' check in complete_keepz_payment to prevent double-credit
SEC-30: Add notification UPDATE (own only) and DELETE (blocked) policies
```

Output DONE when build passes.
