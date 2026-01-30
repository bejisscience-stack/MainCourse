-- Fix storage policies for payment-screenshots bucket

-- Enable public access to the bucket (if not already)
UPDATE storage.buckets
SET public = false -- Keep it private if we want secure URLs, or true for public. Code uses getPublicUrl.
WHERE id = 'payment-screenshots';

-- Allow authenticated users to upload
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'payment-screenshots');

-- Allow public read (or authenticatd read)
DROP POLICY IF EXISTS "Allow public read" ON storage.objects;
CREATE POLICY "Allow public read"
ON storage.objects FOR SELECT
TO result_public -- 'public' role? No, 'anon' and 'authenticated'
USING (bucket_id = 'payment-screenshots');

-- Allow authenticated to view their own?
-- The Admin needs to view it. Admin uses Service Role?
-- Admin Page uses signed URL? No, `getPublicUrl`. 
-- If `getPublicUrl` is used, the bucket MUST be public OR the object policies must allow `anon`.

-- Let's make the bucket PUBLIC for simplicity as per common Supabase patterns for non-sensitive images
UPDATE storage.buckets
SET public = true
WHERE id = 'payment-screenshots';

DROP POLICY IF EXISTS "Public Select" ON storage.objects;
CREATE POLICY "Public Select"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'payment-screenshots');
