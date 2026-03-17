-- Migration 151: Fix public_profiles view & document balance sensitivity (SEC-08, SEC-18)
-- Replace email with safe columns, mark balance as sensitive.

-- Replace existing public_profiles view (from migration 131) with safe columns only
CREATE OR REPLACE VIEW public.public_profiles AS
  SELECT
    id,
    username,
    full_name,
    avatar_url,
    role,
    referral_code,
    is_approved,
    created_at
  FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated;

-- Document balance column as sensitive (SEC-18)
COMMENT ON COLUMN public.profiles.balance IS 'Sensitive: user balance in GEL. Protected by RLS — only visible to the user themselves and admins.';
