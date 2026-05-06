-- ============================================================================
-- 235_privatize_chat_media.sql
--
-- Flip the chat-media bucket from public to private. After this migration,
-- the legacy https://<project>/storage/v1/object/public/chat-media/<path>
-- URLs return 403, and reads must go through signed URLs issued by the edge
-- functions / API routes that authorize the caller (enrollment, lecturer,
-- or admin).
--
-- The existing SELECT policy on storage.objects ("Enrolled users can read
-- chat media", installed by 130 / 149 / 186) is already scoped to
-- enrollment + expiry, lecturer, and admin — no policy change is needed.
-- Service-role signing in the edge functions bypasses that policy anyway,
-- so the policy serves only as defense-in-depth for direct downloads.
--
-- Apply order: deploy the chat-messages / chat-pins / chat-media edge fns
-- and ship the client renderer changes BEFORE applying this migration,
-- otherwise live image rendering breaks in the gap.
-- ============================================================================

UPDATE storage.buckets
   SET public = false
 WHERE id = 'chat-media';
