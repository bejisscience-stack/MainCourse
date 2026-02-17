-- Migration: Fix search_users_by_email to use auth.users as primary source
-- Description: Users without a profile row or with null profile email were not found.
--              Now queries auth.users first and left joins profiles for username/avatar.

CREATE OR REPLACE FUNCTION public.search_users_by_email(
  search_query TEXT,
  exclude_user_id UUID,
  result_limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  username TEXT,
  email TEXT,
  avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    au.id,
    COALESCE(p.username, SPLIT_PART(au.email, '@', 1)) AS username,
    au.email,
    p.avatar_url
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.id = au.id
  WHERE au.id != exclude_user_id
    AND au.email ILIKE '%' || search_query || '%'
  ORDER BY au.email
  LIMIT result_limit;
END;
$$;
