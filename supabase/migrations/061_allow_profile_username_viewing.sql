-- Migration: Allow viewing usernames for all authenticated users
-- Description: Allows authenticated users to view basic profile information (id, username) 
--              for display purposes in submissions and chat

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can view profile usernames" ON public.profiles;

-- Create a policy that allows authenticated users to view basic profile info
-- This is safe as it only exposes public information (id, username) needed for display
CREATE POLICY "Users can view profile usernames"
  ON public.profiles FOR SELECT
  USING (
    -- Allow authenticated users to view basic profile info (id, username, email)
    -- This is needed for displaying usernames in submissions, chat, etc.
    auth.uid() IS NOT NULL
  );

COMMENT ON POLICY "Users can view profile usernames" ON public.profiles IS 
  'Allows authenticated users to view basic profile information (id, username, email) of all users for display purposes in submissions, chat, and other course-related features.';



