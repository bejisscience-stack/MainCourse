-- Migration: Create function to fetch profiles for friend requests
-- Description: Creates a SECURITY DEFINER function to fetch profiles, bypassing RLS
-- This is needed because server-side Supabase clients may not set auth.uid() correctly

CREATE OR REPLACE FUNCTION public.get_profiles_for_friend_requests(user_ids UUID[])
RETURNS TABLE (
  id UUID,
  username TEXT,
  email TEXT
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
    p.email
  FROM public.profiles p
  WHERE p.id = ANY(user_ids);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_profiles_for_friend_requests(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profiles_for_friend_requests(UUID[]) TO anon;

COMMENT ON FUNCTION public.get_profiles_for_friend_requests IS 
  'Fetches profiles for friend requests. Uses SECURITY DEFINER to bypass RLS for server-side queries.';

