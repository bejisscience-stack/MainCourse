-- ============================================================================
-- 238_chat_media_url_to_path_backfill.sql
--
-- After 235 privatizes the chat-media bucket, the public URLs stored in
-- message_attachments.file_url and projects.video_link stop resolving.
-- Strip the "https://<project>.supabase.co/storage/v1/object/public/chat-media/"
-- prefix in place, leaving just the bucket-relative path
-- (<courseId>/<channelId>/<userId>/<filename>). Read-side code already
-- detects path-only values and signs them on demand.
--
-- Idempotent: a second run finds no rows matching the LIKE filter.
--
-- Apply order: AFTER the read-side code (chat-messages / chat-pins / sign API
-- / renderer) is deployed AND migration 235 has been applied. Running this
-- before the read-side updates would render every existing chat attachment
-- and project video as a broken image until those updates ship.
-- ============================================================================

-- Chat attachments
UPDATE public.message_attachments
   SET file_url = regexp_replace(
         file_url,
         '^https://[^/]+/storage/v1/object/public/chat-media/',
         ''
       )
 WHERE file_url LIKE 'https://%/storage/v1/object/public/chat-media/%';

-- Project-submission videos that were stored as chat-media public URLs.
-- YouTube / external video links stay untouched because they don't match.
UPDATE public.projects
   SET video_link = regexp_replace(
         video_link,
         '^https://[^/]+/storage/v1/object/public/chat-media/',
         ''
       )
 WHERE video_link LIKE 'https://%/storage/v1/object/public/chat-media/%';
