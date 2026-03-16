-- Migration: Create SECURITY DEFINER function to fetch safe profile columns
-- Reason: Migration 131 dropped the permissive "Users can view profile usernames"
-- RLS policy to protect balance/bank_account_number. This broke client-side
-- profile lookups (ProjectCard, chat members, realtime messages).
-- Fix: RPC that returns only safe columns, bypassing RLS.

CREATE OR REPLACE FUNCTION public.get_safe_profiles(user_ids UUID[])
RETURNS TABLE (
  id UUID,
  username TEXT,
  email TEXT,
  avatar_url TEXT,
  role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.username,
    p.email,
    p.avatar_url,
    p.role
  FROM public.profiles p
  WHERE p.id = ANY(user_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_safe_profiles(UUID[]) TO authenticated;

COMMENT ON FUNCTION public.get_safe_profiles IS
  'Returns safe profile columns (no balance/bank_account_number) bypassing RLS. Used for display purposes in chat, submissions, member lists.';
