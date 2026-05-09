-- ============================================================================
-- Pre-mig-219: Drop EMPTY legacy DM/friends tables before mig 219 redesigns them.
--
-- Background:
--   Production carries legacy tables created in Feb 2026:
--     - public.friend_requests   (id, sender_id, receiver_id, status, ...)
--     - public.friendships       (id, user1_id, user2_id, created_at)
--     - public.dm_conversations  (id, user1_id, user2_id, last_message_at, ...)
--     - public.dm_messages       (id, conversation_id, user_id, content, ...)
--
--   Staging/mig 219 redesigns these with a NEW schema:
--     - friendships uses (user_low_id, user_high_id)
--     - dm_conversations is paired with new dm_participants table
--     - additional new tables: dm_message_attachments, dm_unread_messages
--
--   Mig 219 issues `CREATE TABLE IF NOT EXISTS`, which silently skips if the
--   legacy table exists, leaving the schema mismatch in place. New RLS
--   policies and indexes (e.g. friendships_user_low_id_idx) would then fail
--   because the columns they reference don't exist.
--
-- Safety:
--   This migration ABORTS if any legacy table has rows (defense-in-depth
--   against new rows arriving between snapshot and apply). Snapshot at
--   2026-05-09T16:33:02Z showed 0 rows in all four tables, and the user
--   explicitly authorized dropping iff empty on 2026-05-09.
--
-- Behavior on rollback:
--   Not rollbackable — the empty legacy tables are gone. Mig 219 recreates
--   them under the new schema. If you need to revert before mig 219 runs,
--   restore the schema from the prod-pgdump.sql.gz under
--   /backups/20260509T163302Z/.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  fr_count int; fs_count int; dm_count int; dc_count int;
BEGIN
  -- Read counts using a strict timestamp-locked snapshot of each table.
  SELECT COUNT(*) INTO fr_count FROM public.friend_requests;
  SELECT COUNT(*) INTO fs_count FROM public.friendships;
  SELECT COUNT(*) INTO dm_count FROM public.dm_messages;
  SELECT COUNT(*) INTO dc_count FROM public.dm_conversations;

  IF fr_count > 0 OR fs_count > 0 OR dm_count > 0 OR dc_count > 0 THEN
    RAISE EXCEPTION
      'Refusing to drop legacy DM/friends tables: rows present (friend_requests=%, friendships=%, dm_messages=%, dm_conversations=%). Mig 219 cannot safely run while legacy data exists. Investigate before retrying.',
      fr_count, fs_count, dm_count, dc_count;
  END IF;

  RAISE NOTICE 'pre_219: legacy DM/friends tables verified empty — proceeding with DROP';
END $$;

DROP TABLE IF EXISTS public.dm_messages       CASCADE;
DROP TABLE IF EXISTS public.dm_conversations  CASCADE;
DROP TABLE IF EXISTS public.friend_requests   CASCADE;
DROP TABLE IF EXISTS public.friendships       CASCADE;

COMMIT;
