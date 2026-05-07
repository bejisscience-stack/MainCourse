-- Migration 241: Tighten EXECUTE grants on referral/admin helper functions
-- (final_security_guide A-22 / SEC-013, L-02, L-03, M-04).
--
-- check_is_admin(uuid)
--   Granted to anon historically. RLS policies that reference it always pair it
--   with auth.uid() guards, and admin API routes pass the caller's JWT, so anon
--   never has a legitimate need for direct EXECUTE. Combined with leaks of
--   admin UUIDs (A-21), anon EXECUTE turns admin discovery into a one-step
--   probe. Revoke from anon.
--
-- generate_referral_code() / auto_generate_referral_code()
--   These are trigger helpers bound to public.profiles via
--   auto_generate_referral_code_trigger. The trigger fires under the inserting
--   role: handle_new_user runs as postgres (SECURITY DEFINER), and direct user
--   updates that null out referral_code originate from authenticated. anon
--   never legitimately inserts/updates profiles. PUBLIC and anon EXECUTE are
--   unnecessary attack surface; the audit identified these as enumeration
--   helpers.
--
-- has_project_access(uuid)
--   Intentionally retained for anon — 3 RLS policies reference it
--   (message_reactions SELECT and INSERT, chat_pinned_messages SELECT) and
--   Postgres checks function EXECUTE at planning time before auth.uid()
--   short-circuits. Revoking anon EXECUTE would surface "permission denied for
--   function has_project_access" against anon SELECTs on those tables.
--   Refresh the COMMENT to match actual referencing policies (the mig 229
--   comment listed an out-of-date policy set).

BEGIN;

-- check_is_admin: revoke anon EXECUTE
REVOKE EXECUTE ON FUNCTION public.check_is_admin(uuid) FROM anon;

-- Referral trigger helpers: revoke PUBLIC + anon EXECUTE; keep authenticated
-- so the trigger continues to fire when an authenticated user updates their
-- own profile row with NULL referral_code.
REVOKE EXECUTE ON FUNCTION public.auto_generate_referral_code() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_referral_code()       FROM PUBLIC, anon;

-- Defensive: ensure authenticated/service_role still have EXECUTE.
GRANT EXECUTE ON FUNCTION public.auto_generate_referral_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_generate_referral_code() TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_referral_code()       TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_referral_code()       TO service_role;

-- has_project_access: anon EXECUTE intentionally unchanged. Refresh COMMENT.
COMMENT ON FUNCTION public.has_project_access(uuid) IS
  'SECURITY DEFINER. anon EXECUTE intentional (migs 229/231/241). Referenced by RLS policies on message_reactions (SELECT, INSERT) and chat_pinned_messages (SELECT). Postgres checks function EXECUTE at plan time before auth.uid() short-circuits, so anon EXECUTE is required for those policies to evaluate. Returns boolean only; no row data is leaked.';

COMMIT;
