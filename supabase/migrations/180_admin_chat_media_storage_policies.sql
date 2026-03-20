-- Migration 180: Add admin INSERT/UPDATE/DELETE policies for chat-media storage
-- Fixes: Admin users can't upload images in chat because only enrolled/lecturer
-- INSERT policies exist (from migration 024). Migration 149 added admin SELECT but
-- missed INSERT/UPDATE/DELETE.

-- ========================================
-- INSERT POLICY (Upload)
-- ========================================
CREATE POLICY "Chat media admin upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-media' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'admin'
  ) AND
  -- Admin uploads must go into their own user subfolder
  (storage.foldername(name))[3] = auth.uid()::text
);

-- ========================================
-- UPDATE POLICY
-- ========================================
CREATE POLICY "Chat media admin update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'chat-media' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'admin'
  )
);

-- ========================================
-- DELETE POLICY
-- ========================================
CREATE POLICY "Chat media admin delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'chat-media' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'admin'
  )
);
