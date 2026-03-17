-- Migration 140: Properly drop search_users function (PII leak fix)
-- Migration 115 used wrong signature search_users(text), missing the actual (text, uuid, int).
-- This function is SECURITY DEFINER, queries auth.users, returns email to any authenticated user.
-- Zero callsites in codebase — safe to drop.

REVOKE ALL ON FUNCTION public.search_users(text, uuid, int) FROM authenticated;
DROP FUNCTION IF EXISTS public.search_users(text, uuid, int);
