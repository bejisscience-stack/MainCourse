-- Migration 239: Remove email from get_safe_profiles to prevent bulk PII
-- enumeration by any authenticated caller (final_security_guide A-3 / SEC-001).
--
-- get_safe_profiles previously returned (id, username, email, avatar_url, role)
-- via decrypt_pii(p.encrypted_email). Since the function is SECURITY DEFINER and
-- granted to the authenticated role, any logged-in user could exfiltrate every
-- user's email by passing batches of UUIDs (chat participants, DMs, project
-- submissions, etc.). Email is needed only by the admin notification sender,
-- which now goes through a service-role admin endpoint backed by
-- get_decrypted_profiles (already restricted to service_role since mig 174).
--
-- All non-admin callers (chat hooks, dm-* edge fns, friends, project cards,
-- useActiveProjects, chat-pins) only read id/username/avatar_url/role. Dropping
-- email leaves the field undefined for those callers; downstream destructures
-- are non-throwing and existing rendering only references the non-PII columns.

BEGIN;

DROP FUNCTION IF EXISTS public.get_safe_profiles(uuid[]);

CREATE OR REPLACE FUNCTION public.get_safe_profiles(user_ids uuid[])
RETURNS TABLE (
  id uuid,
  username text,
  avatar_url text,
  role text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.username, p.avatar_url, p.role
  FROM public.profiles p
  WHERE p.id = ANY(user_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.get_safe_profiles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_safe_profiles(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_safe_profiles(uuid[]) TO service_role;

COMMENT ON FUNCTION public.get_safe_profiles(uuid[]) IS
  'Returns non-PII profile fields (id, username, avatar_url, role) for a batch of user IDs. Email was removed in mig 239 (final_security_guide A-3) — admin email-list flows go through /api/admin/users-with-emails (service-role + get_decrypted_profiles).';

COMMIT;
