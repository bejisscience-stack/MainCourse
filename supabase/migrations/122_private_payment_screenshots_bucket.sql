-- Security: Make payment-screenshots bucket private (INF-01)
-- Payment screenshots contain sensitive financial data and should not be publicly accessible.
-- After this migration, only the uploading user and admins can view screenshots via signed URLs.

-- Make bucket private
UPDATE storage.buckets SET public = false WHERE id = 'payment-screenshots';

-- Drop ALL existing policies for this bucket (from migrations 030, 089)
DROP POLICY IF EXISTS "Users can upload payment screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own payment screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Lecturers can view payment screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Public can view payment screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read" ON storage.objects;
DROP POLICY IF EXISTS "Public Select" ON storage.objects;

-- Authenticated users can upload to their own folder (course_id/user_id/filename)
CREATE POLICY "payment_screenshots_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'payment-screenshots'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Users can view their own uploads
CREATE POLICY "payment_screenshots_select_own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'payment-screenshots'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Admins can view all payment screenshots
CREATE POLICY "payment_screenshots_select_admin"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'payment-screenshots'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- NOTE: course-videos bucket is also public with guessable URLs.
-- Video URLs follow the pattern: /storage/v1/object/public/course-videos/{courseId}/{filename}
-- This is a known risk but NOT changed in this migration. See SECURITY_AUDIT.md for tracking.
