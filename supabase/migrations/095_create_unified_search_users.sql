-- Migration: Create unified search_users RPC function
-- Description: Searches users by username OR email in a single query.
--              Uses SECURITY DEFINER to bypass RLS, queries auth.users + profiles.

CREATE OR REPLACE FUNCTION public.search_users(
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
    NULL::TEXT AS avatar_url
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.id = au.id
  WHERE au.id != exclude_user_id
    AND (
      p.username ILIKE '%' || search_query || '%'
      OR au.email ILIKE '%' || search_query || '%'
    )
  ORDER BY
    -- Exact prefix matches on username first
    CASE WHEN p.username ILIKE search_query || '%' THEN 0 ELSE 1 END,
    -- Then exact prefix matches on email
    CASE WHEN au.email ILIKE search_query || '%' THEN 0 ELSE 1 END,
    -- Then alphabetical by username
    COALESCE(p.username, SPLIT_PART(au.email, '@', 1))
  LIMIT result_limit;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.search_users(TEXT, UUID, INT) TO authenticated;
