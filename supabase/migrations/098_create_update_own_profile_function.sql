-- Migration: Create update_own_profile RPC function
-- Description: Allows authenticated users to update their own username and avatar_url in the profiles table

CREATE OR REPLACE FUNCTION public.update_own_profile(new_username text DEFAULT NULL, new_avatar_url text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id uuid;
  result jsonb;
BEGIN
  -- Get the current authenticated user's ID
  user_id := auth.uid();

  -- Ensure user is authenticated
  IF user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'PGRST301';
  END IF;

  -- Build and execute the update
  UPDATE public.profiles
  SET
    username = CASE WHEN new_username IS NOT NULL THEN new_username ELSE username END,
    avatar_url = CASE
      WHEN new_avatar_url = '__REMOVE__' THEN NULL
      WHEN new_avatar_url IS NOT NULL THEN new_avatar_url
      ELSE avatar_url
    END,
    updated_at = NOW()
  WHERE id = user_id
  RETURNING jsonb_build_object(
    'id', id,
    'username', username,
    'avatar_url', avatar_url,
    'role', role
  ) INTO result;

  -- Return the updated profile
  RETURN result;
END;
$$;
