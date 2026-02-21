-- Migration: Fix all admin policies to use check_is_admin function
-- Description: Prevents RLS recursion by using the check_is_admin function instead of direct profile queries

-- Step 1: Update admin policy for viewing enrollment requests
-- ============================================
DROP POLICY IF EXISTS "Admins can view all enrollment requests" ON public.enrollment_requests;
CREATE POLICY "Admins can view all enrollment requests"
  ON public.enrollment_requests FOR SELECT
  USING (public.check_is_admin(auth.uid()));

-- Step 2: Update admin policy for updating enrollment requests
-- ============================================
DROP POLICY IF EXISTS "Admins can update enrollment requests" ON public.enrollment_requests;
CREATE POLICY "Admins can update enrollment requests"
  ON public.enrollment_requests FOR UPDATE
  USING (public.check_is_admin(auth.uid()));

-- Step 3: Update enrollments admin policies
-- ============================================
DROP POLICY IF EXISTS "Admins can insert enrollments" ON public.enrollments;
CREATE POLICY "Admins can insert enrollments"
  ON public.enrollments FOR INSERT
  WITH CHECK (public.check_is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all enrollments" ON public.enrollments;
CREATE POLICY "Admins can view all enrollments"
  ON public.enrollments FOR SELECT
  USING (public.check_is_admin(auth.uid()));

-- Step 4: Update channels admin policy
-- ============================================
DROP POLICY IF EXISTS "Admins can view all channels" ON public.channels;
CREATE POLICY "Admins can view all channels"
  ON public.channels FOR SELECT
  USING (public.check_is_admin(auth.uid()));

-- Step 5: Update videos admin policy
-- ============================================
DROP POLICY IF EXISTS "Admins can view all videos" ON public.videos;
CREATE POLICY "Admins can view all videos"
  ON public.videos FOR SELECT
  USING (public.check_is_admin(auth.uid()));

