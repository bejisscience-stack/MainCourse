-- Migration: Fix Chat Media Storage Policies
-- Description: Fixes RLS policies for chat-media bucket to match correct path structure
-- Path structure: {course_id}/{channel_id}/{user_id}/{filename}
-- storage.foldername(name) returns: [1]=course_id, [2]=channel_id, [3]=user_id

-- Update bucket settings to allow larger files (50MB)
UPDATE storage.buckets 
SET file_size_limit = 52428800,  -- 50MB
    allowed_mime_types = ARRAY[
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
      'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/mov'
    ]
WHERE id = 'chat-media';

-- Drop ALL existing chat-media policies to start fresh
DROP POLICY IF EXISTS "Enrolled users can upload chat media" ON storage.objects;
DROP POLICY IF EXISTS "Enrolled users can update own chat media" ON storage.objects;
DROP POLICY IF EXISTS "Enrolled users can delete own chat media" ON storage.objects;
DROP POLICY IF EXISTS "Lecturers can upload chat media" ON storage.objects;
DROP POLICY IF EXISTS "Lecturers can update own chat media" ON storage.objects;
DROP POLICY IF EXISTS "Lecturers can delete own chat media" ON storage.objects;
DROP POLICY IF EXISTS "Public can view chat media" ON storage.objects;
DROP POLICY IF EXISTS "Chat media upload policy" ON storage.objects;
DROP POLICY IF EXISTS "Chat media select policy" ON storage.objects;
DROP POLICY IF EXISTS "Chat media update policy" ON storage.objects;
DROP POLICY IF EXISTS "Chat media delete policy" ON storage.objects;

-- ========================================
-- INSERT POLICIES (Upload)
-- ========================================

-- Policy: Enrolled students can upload chat media to channels in courses they're enrolled in
-- Path: {course_id}/{channel_id}/{user_id}/{filename}
CREATE POLICY "Chat media enrolled upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-media' AND
  auth.role() = 'authenticated' AND
  -- First folder is course_id - user must be enrolled in this course
  EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.course_id = (storage.foldername(name))[1]::uuid
    AND e.user_id = auth.uid()
  ) AND
  -- Third folder must be the user's own ID
  (storage.foldername(name))[3] = auth.uid()::text
);

-- Policy: Lecturers can upload chat media to channels in courses they own
CREATE POLICY "Chat media lecturer upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-media' AND
  auth.role() = 'authenticated' AND
  -- First folder is course_id - user must be lecturer of this course
  EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = (storage.foldername(name))[1]::uuid
    AND c.lecturer_id = auth.uid()
  ) AND
  -- Third folder must be the user's own ID
  (storage.foldername(name))[3] = auth.uid()::text
);

-- ========================================
-- SELECT POLICIES (View/Download)
-- ========================================

-- Policy: Anyone can view chat media (bucket is public)
-- This allows public URL access for images/videos in messages
CREATE POLICY "Chat media public read"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-media'
);

-- ========================================
-- UPDATE POLICIES
-- ========================================

-- Policy: Users can update their own uploaded media
CREATE POLICY "Chat media owner update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'chat-media' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[3] = auth.uid()::text
);

-- Policy: Lecturers can update any media in their courses
CREATE POLICY "Chat media lecturer update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'chat-media' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = (storage.foldername(name))[1]::uuid
    AND c.lecturer_id = auth.uid()
  )
);

-- ========================================
-- DELETE POLICIES
-- ========================================

-- Policy: Users can delete their own uploaded media
CREATE POLICY "Chat media owner delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'chat-media' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[3] = auth.uid()::text
);

-- Policy: Lecturers can delete any media in their courses
CREATE POLICY "Chat media lecturer delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'chat-media' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = (storage.foldername(name))[1]::uuid
    AND c.lecturer_id = auth.uid()
  )
);

-- ========================================
-- Verification Query (for debugging)
-- ========================================
-- Run this to verify policies are set up correctly:
-- SELECT policyname, cmd, qual, with_check 
-- FROM pg_policies 
-- WHERE tablename = 'objects' AND schemaname = 'storage';



