-- Migration 194: Fix "permission denied for function check_is_admin" for anon users
--
-- Root cause: Migration 176 revoked EXECUTE on check_is_admin() and has_project_access()
-- from anon. RLS policies on profiles/projects reference these functions, and PostgreSQL
-- validates EXECUTE permissions at query PLANNING time — before any runtime short-circuit
-- (e.g. auth.uid() IS NOT NULL) can take effect. So even with guards, anon queries fail.
--
-- Fix: Grant EXECUTE to anon for both functions. This is safe because:
--   - Both return FALSE for NULL input (anon has no auth.uid)
--   - They only return booleans — no data leakage
--   - Both are SECURITY DEFINER — run as postgres regardless of caller role

-- Keep the guard on profiles policy as defense-in-depth
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND public.check_is_admin(auth.uid())
  );

-- Allow anon to execute these functions so the query planner doesn't error
GRANT EXECUTE ON FUNCTION public.check_is_admin(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.has_project_access(UUID) TO anon;
