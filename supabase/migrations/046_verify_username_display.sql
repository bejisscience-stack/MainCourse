-- Migration: Verify username display works correctly
-- Description: Ensures all necessary RLS policies are in place for username display
-- Run this migration if usernames are still not displaying correctly

-- First, ensure the policy from migration 045 exists
-- This allows authenticated users to view all profiles for friend requests and chat
DO $$
BEGIN
    -- Drop any conflicting policies
    DROP POLICY IF EXISTS "Users can view profiles in same courses" ON public.profiles;
    
    -- Ensure the policy for viewing all profiles exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles' 
        AND policyname = 'Users can view all profiles for friends'
    ) THEN
        CREATE POLICY "Users can view all profiles for friends"
            ON public.profiles FOR SELECT
            USING (auth.uid() IS NOT NULL);
        
        RAISE NOTICE 'Created policy: Users can view all profiles for friends';
    ELSE
        RAISE NOTICE 'Policy already exists: Users can view all profiles for friends';
    END IF;
END $$;

-- Verify that all profiles have usernames
DO $$
DECLARE
    profiles_without_username INT;
BEGIN
    SELECT COUNT(*) INTO profiles_without_username
    FROM public.profiles
    WHERE username IS NULL OR TRIM(username) = '';
    
    IF profiles_without_username > 0 THEN
        RAISE WARNING 'Found % profiles without usernames. Updating from email...', profiles_without_username;
        
        -- Update profiles with missing usernames using email prefix
        UPDATE public.profiles
        SET username = SPLIT_PART(email, '@', 1)
        WHERE username IS NULL OR TRIM(username) = '';
        
        RAISE NOTICE 'Updated % profiles with email-based usernames', profiles_without_username;
    ELSE
        RAISE NOTICE 'All profiles have valid usernames';
    END IF;
END $$;

-- Add comment for documentation
COMMENT ON POLICY "Users can view all profiles for friends" ON public.profiles IS 
    'Allows authenticated users to view basic profile information (id, username, email) for friend requests and chat functionality. Required for username display to work correctly.';

-- Diagnostic query to check profile data (run this in SQL editor to verify)
-- SELECT id, username, email, 
--        CASE WHEN username IS NULL OR TRIM(username) = '' THEN 'MISSING' ELSE 'OK' END as username_status
-- FROM public.profiles
-- ORDER BY created_at DESC
-- LIMIT 20;







