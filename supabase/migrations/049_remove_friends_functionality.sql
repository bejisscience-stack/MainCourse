-- Migration: Remove all friends functionality
-- Description: Drops all tables, functions, triggers, and policies related to friends feature

-- Step 1: Remove triggers first (they depend on functions)
DROP TRIGGER IF EXISTS create_friendship_on_accept ON public.friend_requests;
DROP TRIGGER IF EXISTS delete_friendship_on_reject ON public.friend_requests;
DROP TRIGGER IF EXISTS update_friend_requests_updated_at ON public.friend_requests;

-- Step 2: Remove functions
DROP FUNCTION IF EXISTS public.create_friendship_on_accept() CASCADE;
DROP FUNCTION IF EXISTS public.delete_friendship_on_reject() CASCADE;
DROP FUNCTION IF EXISTS public.update_friend_requests_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.get_profiles_for_friend_requests(UUID[]) CASCADE;

-- Step 3: Remove RLS policies
DROP POLICY IF EXISTS "Users can view own friend requests" ON public.friend_requests;
DROP POLICY IF EXISTS "Users can send friend requests" ON public.friend_requests;
DROP POLICY IF EXISTS "Users can update received friend requests" ON public.friend_requests;
DROP POLICY IF EXISTS "Users can delete sent friend requests" ON public.friend_requests;
DROP POLICY IF EXISTS "Users can view own friendships" ON public.friendships;
DROP POLICY IF EXISTS "Users can delete own friendships" ON public.friendships;

-- Step 4: Remove tables (this will also remove all indexes and constraints)
DROP TABLE IF EXISTS public.friendships CASCADE;
DROP TABLE IF EXISTS public.friend_requests CASCADE;

-- Step 5: Restore original profile viewing policy (revert migration 045)
-- Drop the friends-specific policy
DROP POLICY IF EXISTS "Users can view all profiles for friends" ON public.profiles;

-- Restore the original policy from migration 018 (allows viewing profiles of users in same courses)
-- This policy was replaced by migration 045, so we restore it
CREATE POLICY IF NOT EXISTS "Users can view profiles in same courses"
  ON public.profiles FOR SELECT
  USING (
    -- Users can view profiles of other users enrolled in the same courses
    EXISTS (
      SELECT 1 FROM public.enrollments e1
      JOIN public.enrollments e2 ON e1.course_id = e2.course_id
      WHERE e1.user_id = auth.uid()
      AND e2.user_id = profiles.id
      AND e1.user_id != e2.user_id
    )
    OR
    -- Lecturers can view profiles of users enrolled in their courses
    EXISTS (
      SELECT 1 FROM public.courses c
      JOIN public.enrollments e ON e.course_id = c.id
      WHERE c.lecturer_id = auth.uid()
      AND e.user_id = profiles.id
      AND c.lecturer_id != e.user_id
    )
    OR
    -- Users can view profiles of lecturers whose courses they're enrolled in
    EXISTS (
      SELECT 1 FROM public.courses c
      JOIN public.enrollments e ON e.course_id = c.id
      WHERE c.lecturer_id = profiles.id
      AND e.user_id = auth.uid()
      AND c.lecturer_id != e.user_id
    )
  );

-- Step 6: Remove realtime publication entries (if they exist)
-- Note: This is handled automatically when tables are dropped, but we document it here
-- ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.friend_requests;
-- ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.friendships;

COMMENT ON POLICY "Users can view profiles in same courses" ON public.profiles IS 
  'Allows users to view profiles of other users enrolled in the same courses for chat functionality';

