-- Migration: Create Storage Buckets for Course Videos and Thumbnails
-- Description: Creates storage buckets and policies for lecturer file uploads

-- Create course-videos bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-videos',
  'course-videos',
  true,
  52428800, -- 50MB
  ARRAY['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska']
)
ON CONFLICT (id) DO UPDATE SET
  allowed_mime_types = ARRAY['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];

-- Create course-thumbnails bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-thumbnails',
  'course-thumbnails',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Lecturers can upload videos" ON storage.objects;
DROP POLICY IF EXISTS "Lecturers can update own videos" ON storage.objects;
DROP POLICY IF EXISTS "Lecturers can delete own videos" ON storage.objects;
DROP POLICY IF EXISTS "Lecturers can upload thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Lecturers can update own thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Lecturers can delete own thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Public can view videos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view thumbnails" ON storage.objects;

-- Policy: Lecturers can upload videos to their own folder
CREATE POLICY "Lecturers can upload videos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'course-videos' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'lecturer'
  ) AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Lecturers can update their own videos
CREATE POLICY "Lecturers can update own videos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'course-videos' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'lecturer'
  ) AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Lecturers can delete their own videos
CREATE POLICY "Lecturers can delete own videos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'course-videos' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'lecturer'
  ) AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Lecturers can upload thumbnails to their own folder
CREATE POLICY "Lecturers can upload thumbnails"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'course-thumbnails' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'lecturer'
  ) AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Lecturers can update their own thumbnails
CREATE POLICY "Lecturers can update own thumbnails"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'course-thumbnails' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'lecturer'
  ) AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Lecturers can delete their own thumbnails
CREATE POLICY "Lecturers can delete own thumbnails"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'course-thumbnails' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'lecturer'
  ) AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Public can view videos
CREATE POLICY "Public can view videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'course-videos');

-- Policy: Public can view thumbnails
CREATE POLICY "Public can view thumbnails"
ON storage.objects FOR SELECT
USING (bucket_id = 'course-thumbnails');

