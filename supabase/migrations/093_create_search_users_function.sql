-- Migration: Create search_users_by_email RPC function
-- Description: Server-side function to search users by email, since profiles.email
--              may not always be queryable via client-side ilike due to RLS or data gaps.
--              Falls back to auth.users email if profile email is null.

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
  SELECT DISTINCT ON (p.id)
    p.id,
    p.username,
    COALESCE(p.email, au.email) AS email,
    p.avatar_url
  FROM public.profiles p
  LEFT JOIN auth.users au ON au.id = p.id
  WHERE p.id != exclude_user_id
    AND (
      p.email ILIKE '%' || search_query || '%'
      OR au.email ILIKE '%' || search_query || '%'
    )
  ORDER BY p.id
  LIMIT result_limit;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.search_users_by_email(TEXT, UUID, INT) TO authenticated;
