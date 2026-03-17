-- Migration 149: Fix chat-media storage SELECT policy (SEC-12)
-- Drop public read access. Only enrolled users, course lecturers, and admins can read.

-- Drop the overly-permissive public read policy (from migration 024)
DROP POLICY IF EXISTS "Chat media public read" ON storage.objects;

-- Create enrollment/lecturer/admin-based read policy
CREATE POLICY "Enrolled users can read chat media"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-media' AND
  auth.role() = 'authenticated' AND
  (
    -- Enrolled students can read media in their courses
    EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.course_id = (storage.foldername(name))[1]::uuid
      AND e.user_id = auth.uid()
      AND (e.expires_at IS NULL OR e.expires_at > NOW())
    )
    OR
    -- Course lecturers can read media in their courses
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = (storage.foldername(name))[1]::uuid
      AND c.lecturer_id = auth.uid()
    )
    OR
    -- Admins can read all chat media
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  )
);
