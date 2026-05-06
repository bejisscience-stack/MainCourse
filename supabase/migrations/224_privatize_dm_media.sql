-- ============================================================================
-- 224_privatize_dm_media.sql
--
-- Flips the dm-media bucket from public to private and tightens the SELECT
-- policy on storage.objects so dm media is reachable only via signed URLs
-- after a participant check. Adds a file_path column to dm_message_attachments
-- so the renderer can derive a fresh signed URL per render.
--
-- Existing dm_message_attachments rows have only file_url (a public URL that
-- will stop resolving once the bucket is private). On staging this is
-- acceptable; legacy DM media will surface as "Failed to load" in the UI.
-- ============================================================================

-- 1. Bucket: public -> false
UPDATE storage.buckets
   SET public = false
 WHERE id = 'dm-media';

-- 2. Tighten SELECT policy: drop the "OR true" escape hatch.
DROP POLICY IF EXISTS "Participants can view dm media" ON storage.objects;
CREATE POLICY "Participants can view dm media"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'dm-media'
    AND EXISTS (
      SELECT 1 FROM public.dm_participants p
      WHERE p.conversation_id = ((storage.foldername(name))[1])::uuid
        AND p.user_id = (select auth.uid())
    )
  );

-- 3. Canonical storage path on attachments. Nullable so legacy rows stay valid.
ALTER TABLE public.dm_message_attachments
  ADD COLUMN IF NOT EXISTS file_path TEXT;
