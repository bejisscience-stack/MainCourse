-- Migration: Add admin access to courses and channels
-- Description: Allows admins to view and access all courses and channels without enrollment

-- Step 1: Add admin access to channels
-- ============================================

-- Admins can view all channels
DROP POLICY IF EXISTS "Admins can view all channels" ON public.channels;
CREATE POLICY "Admins can view all channels"
  ON public.channels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Step 2: Ensure courses are already viewable by everyone (they should be based on existing policies)
-- Courses table already has "Courses are viewable by everyone" policy, so no change needed

-- Step 3: Add admin access to videos (so admins can view all course videos)
-- ============================================
DROP POLICY IF EXISTS "Admins can view all videos" ON public.videos;
CREATE POLICY "Admins can view all videos"
  ON public.videos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Step 4: Add admin access to enrollments (so admins can see all enrollments)
-- ============================================
DROP POLICY IF EXISTS "Admins can view all enrollments" ON public.enrollments;
CREATE POLICY "Admins can view all enrollments"
  ON public.enrollments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

