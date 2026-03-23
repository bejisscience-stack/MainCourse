-- Migration 194: Fix "permission denied for function check_is_admin" for anon users
--
-- Root cause: Migration 176 revoked EXECUTE on check_is_admin() from anon.
-- The profiles RLS policy "Admins can view all profiles" calls check_is_admin(auth.uid()).
-- PostgreSQL evaluates ALL SELECT policies even for anon, and since anon cannot
-- EXECUTE check_is_admin, the entire query errors out.
--
-- Fix: Add auth.uid() IS NOT NULL guard so the policy short-circuits to FALSE
-- for anon without calling check_is_admin(). Same pattern as migration 189.

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND public.check_is_admin(auth.uid())
  );
