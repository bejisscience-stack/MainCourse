-- SEC-01: Remove wide-open SELECT policy from chat-media bucket
-- Migration 024 created "Chat media public read" with no enrollment check.
-- This replaces it with proper enrollment/lecturer/admin checks.
-- Path structure: {course_id}/{channel_id}/{user_id}/{filename}
-- foldername(name)[1] = course_id

-- Drop both possible policy names (023's and 024's)
DROP POLICY IF EXISTS "Public can view chat media" ON storage.objects;
DROP POLICY IF EXISTS "Chat media public read" ON storage.objects;

CREATE POLICY "Enrolled users and lecturers can view chat media"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-media' AND
  (
    -- User is enrolled in the course
    EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.course_id = (storage.foldername(name))[1]::uuid
      AND e.user_id = auth.uid()
    ) OR
    -- User is lecturer of the course
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = (storage.foldername(name))[1]::uuid
      AND c.lecturer_id = auth.uid()
    ) OR
    -- Admin users can view all chat media
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
);
