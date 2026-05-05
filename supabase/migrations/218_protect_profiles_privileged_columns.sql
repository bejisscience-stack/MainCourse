-- Migration 218: Protect privileged profiles columns from direct user UPDATEs
--
-- Background:
--   The migration-002 "Users can update own profile" RLS policy
--   (`USING (auth.uid() = id)`, no WITH CHECK, no column scoping) lets any
--   authenticated user mutate any column of their own row via PostgREST.
--   That's been the case since day one. Codex round-4 audit identified five
--   privileged columns where this is exploitable in ways that bypass
--   admin/payment/withdrawal gates:
--
--     - balance                       → self-credit, then withdraw real money
--     - is_approved                   → bypass admin lecturer-approval gate
--                                       (courses INSERT RLS, migration 150)
--     - lecturer_status               → mark self as 'approved' lecturer
--     - project_access_expires_at     → self-extend project access
--                                       (has_project_access, migration 104)
--     - can_create_free_projects      → skip Keepz budget payment
--                                       (set_project_pending_payment_if_required, migration 205)
--     - profile_completed             → reset to false to re-enter
--                                       /api/complete-profile and self-promote role
--
--   This migration adds a single BEFORE UPDATE trigger that raises if any of
--   these columns is changed by a caller running as 'authenticated' or 'anon'
--   (the PostgREST roles). SECURITY DEFINER functions owned by `postgres`
--   (e.g. credit_user_balance, debit_user_balance, approve_lecturer_account,
--   create_withdrawal_request) and service-role API routes (which authenticate
--   as `service_role`) are unaffected.
--
-- Companion fixes outside this migration:
--   - app/api/complete-profile/route.ts: stops writing `role`; sets
--     lecturer_status='pending' instead. Combined with the protection of
--     profile_completed below, the service-role re-entry attack is closed.
--   - app/admin/page.tsx and app/lecturer/dashboard/page.tsx: route guards
--     now read `profile?.role` directly instead of the metadata-fallback
--     value from useUser().
--
-- Down-migration:
--   DROP TRIGGER IF EXISTS protect_profiles_privileged_columns ON public.profiles;
--   DROP FUNCTION IF EXISTS public.protect_profiles_privileged_columns();

CREATE OR REPLACE FUNCTION public.protect_profiles_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only PostgREST user calls (authenticated/anon) are blocked. Everything
  -- else passes through: SECURITY DEFINER functions execute as their owner
  -- (typically `postgres`), service-role API routes run as `service_role`,
  -- Dashboard SQL editor runs as `postgres` / `supabase_admin`.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF NEW.balance IS DISTINCT FROM OLD.balance THEN
    RAISE EXCEPTION
      'profiles.balance cannot be modified by users; use credit_user_balance/debit_user_balance'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.is_approved IS DISTINCT FROM OLD.is_approved THEN
    RAISE EXCEPTION
      'profiles.is_approved cannot be modified by users; use approve_lecturer_account'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.lecturer_status IS DISTINCT FROM OLD.lecturer_status THEN
    RAISE EXCEPTION
      'profiles.lecturer_status cannot be modified by users'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.project_access_expires_at IS DISTINCT FROM OLD.project_access_expires_at THEN
    RAISE EXCEPTION
      'profiles.project_access_expires_at cannot be modified by users'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.can_create_free_projects IS DISTINCT FROM OLD.can_create_free_projects THEN
    RAISE EXCEPTION
      'profiles.can_create_free_projects cannot be modified by users'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.profile_completed IS DISTINCT FROM OLD.profile_completed THEN
    RAISE EXCEPTION
      'profiles.profile_completed cannot be modified by users'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profiles_privileged_columns ON public.profiles;
CREATE TRIGGER protect_profiles_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profiles_privileged_columns();

COMMENT ON FUNCTION public.protect_profiles_privileged_columns() IS
  'Migration 218: Blocks PostgREST user-driven UPDATE of privileged profiles columns. Service-role and SECURITY DEFINER calls bypass.';
