-- Remove overlapping chat-media SELECT policy that bypasses enrollment expiry check
-- The stricter "Enrolled users can read chat media" policy remains and enforces expiry
DROP POLICY IF EXISTS "Enrolled users and lecturers can view chat media" ON storage.objects;
