-- Migration: Fix Storage Policies for Video Uploads
-- Description: Update storage policies to allow lecturers to upload to course folders

-- Drop existing storage policies
DROP POLICY IF EXISTS "Lecturers can upload videos" ON storage.objects;
DROP POLICY IF EXISTS "Lecturers can update own videos" ON storage.objects;
DROP POLICY IF EXISTS "Lecturers can delete own videos" ON storage.objects;
DROP POLICY IF EXISTS "Lecturers can upload thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Lecturers can update own thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Lecturers can delete own thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Public can view videos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view thumbnails" ON storage.objects;

-- Ensure buckets exist with increased file size limit
UPDATE storage.buckets 
SET file_size_limit = 524288000 -- 500MB for larger videos
WHERE id = 'course-videos';

-- Policy: Lecturers can upload videos to course folders they own
CREATE POLICY "Lecturers can upload videos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'course-videos' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.courses
    WHERE courses.id::text = (storage.foldername(name))[1]
    AND courses.lecturer_id = auth.uid()
  )
);

-- Policy: Lecturers can update videos in their course folders
CREATE POLICY "Lecturers can update own videos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'course-videos' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.courses
    WHERE courses.id::text = (storage.foldername(name))[1]
    AND courses.lecturer_id = auth.uid()
  )
);

-- Policy: Lecturers can delete videos from their course folders
CREATE POLICY "Lecturers can delete own videos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'course-videos' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.courses
    WHERE courses.id::text = (storage.foldername(name))[1]
    AND courses.lecturer_id = auth.uid()
  )
);

-- Policy: Lecturers can upload thumbnails to course folders they own
CREATE POLICY "Lecturers can upload thumbnails"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'course-thumbnails' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.courses
    WHERE courses.id::text = (storage.foldername(name))[1]
    AND courses.lecturer_id = auth.uid()
  )
);

-- Policy: Lecturers can update thumbnails in their course folders
CREATE POLICY "Lecturers can update own thumbnails"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'course-thumbnails' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.courses
    WHERE courses.id::text = (storage.foldername(name))[1]
    AND courses.lecturer_id = auth.uid()
  )
);

-- Policy: Lecturers can delete thumbnails from their course folders
CREATE POLICY "Lecturers can delete own thumbnails"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'course-thumbnails' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.courses
    WHERE courses.id::text = (storage.foldername(name))[1]
    AND courses.lecturer_id = auth.uid()
  )
);

-- Policy: Public can view all videos (bucket is public)
CREATE POLICY "Public can view videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'course-videos');

-- Policy: Public can view all thumbnails (bucket is public)
CREATE POLICY "Public can view thumbnails"
ON storage.objects FOR SELECT
USING (bucket_id = 'course-thumbnails');









