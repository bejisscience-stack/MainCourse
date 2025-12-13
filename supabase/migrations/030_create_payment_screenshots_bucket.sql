-- Migration: Create Storage Bucket for Payment Screenshots
-- Description: Creates storage bucket for payment transaction screenshots during course enrollment

-- Create payment-screenshots bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-screenshots',
  'payment-screenshots',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload payment screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own payment screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Lecturers can view payment screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Public can view payment screenshots" ON storage.objects;

-- Policy: Authenticated users can upload payment screenshots
-- Path structure: course_id/user_id/filename
CREATE POLICY "Users can upload payment screenshots"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'payment-screenshots' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy: Users can view their own payment screenshots
CREATE POLICY "Users can view own payment screenshots"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'payment-screenshots' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy: Lecturers can view payment screenshots for their courses
CREATE POLICY "Lecturers can view payment screenshots"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'payment-screenshots' AND
  EXISTS (
    SELECT 1 FROM public.courses
    WHERE courses.id::text = (storage.foldername(name))[1]
    AND courses.lecturer_id = auth.uid()
  )
);

-- Policy: Public can view payment screenshots (for enrollment verification)
CREATE POLICY "Public can view payment screenshots"
ON storage.objects FOR SELECT
USING (bucket_id = 'payment-screenshots');

