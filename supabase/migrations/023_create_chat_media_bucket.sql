-- Migration: Create Storage Bucket for Chat Media
-- Description: Creates storage bucket for chat attachments (images, videos, GIFs)

-- Create chat-media bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media',
  'chat-media',
  true,
  10485760, -- 10MB
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'
  ];

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enrolled users can upload chat media" ON storage.objects;
DROP POLICY IF EXISTS "Enrolled users can update own chat media" ON storage.objects;
DROP POLICY IF EXISTS "Enrolled users can delete own chat media" ON storage.objects;
DROP POLICY IF EXISTS "Lecturers can upload chat media" ON storage.objects;
DROP POLICY IF EXISTS "Lecturers can update own chat media" ON storage.objects;
DROP POLICY IF EXISTS "Lecturers can delete own chat media" ON storage.objects;
DROP POLICY IF EXISTS "Public can view chat media" ON storage.objects;

-- Policy: Enrolled users can upload chat media
CREATE POLICY "Enrolled users can upload chat media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-media' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.channels c
    JOIN public.enrollments e ON e.course_id = c.course_id
    WHERE c.id = (storage.foldername(name))[1]::uuid
    AND e.user_id = auth.uid()
  ) AND
  (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);

-- Policy: Lecturers can upload chat media
CREATE POLICY "Lecturers can upload chat media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-media' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.channels c
    JOIN public.courses co ON co.id = c.course_id
    WHERE c.id = (storage.foldername(name))[1]::uuid
    AND co.lecturer_id = auth.uid()
  ) AND
  (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);

-- Policy: Enrolled users can update their own chat media
CREATE POLICY "Enrolled users can update own chat media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'chat-media' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy: Lecturers can update their own chat media
CREATE POLICY "Lecturers can update own chat media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'chat-media' AND
  auth.role() = 'authenticated' AND
  (
    (storage.foldername(name))[2] = auth.uid()::text OR
    EXISTS (
      SELECT 1 FROM public.channels c
      JOIN public.courses co ON co.id = c.course_id
      WHERE c.id = (storage.foldername(name))[1]::uuid
      AND co.lecturer_id = auth.uid()
    )
  )
);

-- Policy: Enrolled users can delete their own chat media
CREATE POLICY "Enrolled users can delete own chat media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'chat-media' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy: Lecturers can delete chat media in their courses
CREATE POLICY "Lecturers can delete own chat media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'chat-media' AND
  auth.role() = 'authenticated' AND
  (
    (storage.foldername(name))[2] = auth.uid()::text OR
    EXISTS (
      SELECT 1 FROM public.channels c
      JOIN public.courses co ON co.id = c.course_id
      WHERE c.id = (storage.foldername(name))[1]::uuid
      AND co.lecturer_id = auth.uid()
    )
  )
);

-- Policy: Public can view chat media (enrolled users and lecturers can see)
CREATE POLICY "Public can view chat media"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-media' AND
  (
    -- User is enrolled in the course
    EXISTS (
      SELECT 1 FROM public.channels c
      JOIN public.enrollments e ON e.course_id = c.course_id
      WHERE c.id = (storage.foldername(name))[1]::uuid
      AND e.user_id = auth.uid()
    ) OR
    -- User is lecturer of the course
    EXISTS (
      SELECT 1 FROM public.channels c
      JOIN public.courses co ON co.id = c.course_id
      WHERE c.id = (storage.foldername(name))[1]::uuid
      AND co.lecturer_id = auth.uid()
    ) OR
    -- Public access (for now, can be restricted later)
    true
  )
);










