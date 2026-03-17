-- Migration 150: Require lecturer approval for course creation (SEC-16)
-- Unapproved lecturers should not be able to create courses.

-- Drop existing INSERT policy (from migration 123)
DROP POLICY IF EXISTS "Lecturers and admins can insert courses" ON public.courses;

-- Recreate with is_approved check for lecturers
CREATE POLICY "Approved lecturers and admins can insert courses"
ON public.courses FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (
      (p.role = 'lecturer' AND p.is_approved = true)
      OR p.role = 'admin'
    )
  )
  AND lecturer_id = auth.uid()
);
