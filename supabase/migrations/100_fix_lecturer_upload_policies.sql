-- Migration: Fix RLS Policies for Lecturer Course Creation Uploads
-- Description: Allow lecturers to upload files to user-owned paths during course creation
-- and remove file size limits from both buckets

-- Drop existing INSERT policies that require course ownership
DROP POLICY IF EXISTS "Lecturers can upload videos" ON storage.objects;
DROP POLICY IF EXISTS "Lecturers can upload thumbnails" ON storage.objects;

-- Remove file size limits from both buckets (set to NULL for unlimited)
UPDATE storage.buckets SET file_size_limit = NULL
WHERE id IN ('course-videos', 'course-thumbnails');

-- New INSERT policy for course-videos with OR condition:
-- Allow uploads to course folders OR to user's own temporary folder during creation
CREATE POLICY "Lecturers can upload videos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'course-videos' AND
  auth.role() = 'authenticated' AND
  (
    -- Option A: Existing flow - upload to course folder the lecturer owns
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id::text = (storage.foldername(name))[1]
      AND courses.lecturer_id = auth.uid()
    )
    OR
    -- Option B: New flow - upload to user's temp folder during course creation
    (
      (storage.foldername(name))[1] = auth.uid()::text AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'lecturer'
      )
    )
  )
);

-- New INSERT policy for course-thumbnails with OR condition (same pattern)
CREATE POLICY "Lecturers can upload thumbnails"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'course-thumbnails' AND
  auth.role() = 'authenticated' AND
  (
    -- Option A: Existing flow - upload to course folder the lecturer owns
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id::text = (storage.foldername(name))[1]
      AND courses.lecturer_id = auth.uid()
    )
    OR
    -- Option B: New flow - upload to user's temp folder during course creation
    (
      (storage.foldername(name))[1] = auth.uid()::text AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'lecturer'
      )
    )
  )
);
