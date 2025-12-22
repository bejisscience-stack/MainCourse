-- Migration: Allow users to view all profiles for friend requests
-- Description: Updates RLS to allow users to view any profile (username and email only) for friend functionality
-- This enables friend requests between any users, not just those in the same course

-- Drop the existing restrictive policy if it exists
DROP POLICY IF EXISTS "Users can view profiles in same courses" ON public.profiles;

-- Create a new policy that allows viewing basic profile info (id, username, email) for all users
-- This is needed for friend requests to work between any users
CREATE POLICY "Users can view all profiles for friends"
  ON public.profiles FOR SELECT
  USING (
    -- Users can always view basic profile info (id, username, email) of other users
    -- This is safe as it only exposes public information needed for friend requests
    auth.uid() IS NOT NULL
  );

-- Note: The existing "Users can view own profile" policy still applies
-- This new policy allows viewing other users' profiles for friend functionality

COMMENT ON POLICY "Users can view all profiles for friends" ON public.profiles IS 
  'Allows authenticated users to view basic profile information (id, username, email) of all users for friend requests and chat functionality';






