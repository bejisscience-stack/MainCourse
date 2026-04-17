-- =============================================================================
-- Migration 203: Tighten chat-media bucket size limit (2026-04-17)
-- =============================================================================
-- Closes audit finding H2. The chat-media bucket had file_size_limit set to
-- 10 GB (10737418240 bytes) — an order of magnitude larger than necessary for
-- chat attachments. This allowed any enrolled user to upload multi-GB files
-- per message, a cost/DoS vector on DO Spaces + Supabase storage.
--
-- Drops the limit to 100 MB (104857600 bytes), which comfortably covers every
-- legitimate chat media use case (images, short videos, voice clips).
-- allowed_mime_types already restricts to image/* and video/*.
-- Existing files are unaffected — the limit only applies to future uploads.
-- =============================================================================

BEGIN;

UPDATE storage.buckets
SET file_size_limit = 104857600  -- 100 MB (was 10 GB = 10737418240)
WHERE id = 'chat-media';

COMMIT;
