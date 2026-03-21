-- Migration 183: Add enrollment expiry check to course-videos storage policy
-- Fixes MED-02: Expired enrollments should not grant access to course videos

DROP POLICY IF EXISTS "Enrolled users can view course videos" ON storage.objects;

CREATE POLICY "Enrolled users can view course videos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'course-videos'
  AND EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE enrollments.user_id = auth.uid()
    AND enrollments.course_id = (storage.foldername(name))[1]::uuid
    AND (enrollments.expires_at IS NULL OR enrollments.expires_at > NOW())
  )
);
