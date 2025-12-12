-- Migration: Update profiles RLS to allow viewing profiles of users in same course
-- Description: Allows users to view profiles of other users enrolled in the same courses for chat functionality

-- Add new policy: Users can view profiles of users enrolled in the same courses
-- This policy works alongside the existing "Users can view own profile" policy
CREATE POLICY "Users can view profiles in same courses"
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




