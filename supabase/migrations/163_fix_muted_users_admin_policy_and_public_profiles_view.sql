-- Migration 163: Add admin SELECT on muted_users + remove full_name from public_profiles
-- Fixes: SEC audit — muted_users missing admin access, public_profiles exposes PII

-- Part 1: Admin SELECT policy on muted_users (additive — no existing policies touched)
DROP POLICY IF EXISTS "Admins can view all muted users" ON public.muted_users;
CREATE POLICY "Admins can view all muted users"
  ON public.muted_users FOR SELECT
  USING (check_is_admin(auth.uid()));

-- Part 2: Remove full_name from public_profiles view (no code depends on it)
-- DROP + CREATE required because CREATE OR REPLACE cannot drop columns
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles AS
  SELECT
    id,
    username,
    avatar_url,
    role,
    referral_code,
    is_approved,
    created_at
  FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated;
