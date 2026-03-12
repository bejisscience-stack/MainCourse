-- Migration: Make course-videos bucket private (DATA-01)
-- Paid lecture videos should only be accessible to enrolled students, lecturers, and admins.
-- Intro/marketing videos remain publicly accessible via narrow RLS policies.

-- Step 1: Make bucket private
UPDATE storage.buckets SET public = false WHERE id = 'course-videos';

-- Step 2: Drop the permissive public SELECT policy
DROP POLICY IF EXISTS "Public can view videos" ON storage.objects;

-- Step 3: Enrolled users can view course lecture videos (files in {courseId}/ folders)
CREATE POLICY "Enrolled users can view course videos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'course-videos'
  AND EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE enrollments.user_id = auth.uid()
    AND enrollments.course_id = (storage.foldername(name))[1]::uuid
  )
);

-- Step 4: Lecturers can view their own course videos
CREATE POLICY "Lecturers can view own course videos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'course-videos'
  AND EXISTS (
    SELECT 1 FROM public.courses
    WHERE courses.lecturer_id = auth.uid()
    AND courses.id = (storage.foldername(name))[1]::uuid
  )
);

-- Step 5: Admins can view all course videos
CREATE POLICY "Admins can view all course videos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'course-videos'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Step 6: Narrowly-scoped public access for intro videos ONLY
-- Allows unauthenticated browsing of course cards with intro video previews
-- Only files specifically referenced in courses.intro_video_url are accessible
CREATE POLICY "Public can view course intro videos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'course-videos'
  AND name IN (
    SELECT regexp_replace(intro_video_url, '^.*/course-videos/', '')
    FROM public.courses
    WHERE intro_video_url IS NOT NULL
    AND intro_video_url LIKE '%/course-videos/%'
  )
);

-- Step 7: Root-level marketing video used in VideoSection.tsx landing page
-- This file is at bucket root (not in a course folder), not referenced in courses.intro_video_url
CREATE POLICY "Public can view root intro video"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'course-videos'
  AND name = 'intro-video.mp4'
);
