-- Migration 223: Tighten EXECUTE on two SECURITY DEFINER functions flagged by advisor
--
-- 1. set_project_pending_payment_if_required() — trigger function from mig 205.
--    Mig 205 only REVOKEd from PUBLIC; Supabase's default privileges had granted
--    EXECUTE directly to anon/authenticated/service_role, so anon retained EXECUTE.
--    Trigger functions don't need any caller-role EXECUTE — the trigger fires
--    as the function owner on table-write events. Match mig 177 treatment of
--    handle_new_user(), auto_encrypt_pii(), etc.: revoke from PUBLIC and anon.
--    (Authenticated/service_role left alone — no functional change either way,
--    keeping minimal blast radius for this revoke.)
--
-- 2. check_is_admin(uuid) — anon EXECUTE is INTENTIONAL (mig 194). Do not revoke.
--    Refresh COMMENT so the justification is inline for the next advisor sweep.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.set_project_pending_payment_if_required() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_project_pending_payment_if_required() FROM anon;

COMMENT ON FUNCTION public.check_is_admin(uuid) IS
  'SECURITY DEFINER. anon EXECUTE is intentional (mig 194): RLS policies on profiles/projects reference this function and PostgreSQL checks EXECUTE at plan time, before the auth.uid() IS NOT NULL guard can short-circuit. Returns boolean only; no data leak.';

COMMIT;
