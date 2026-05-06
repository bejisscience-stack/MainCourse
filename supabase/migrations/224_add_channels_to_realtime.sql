-- Migration: Add channels to supabase_realtime publication
-- Description: The chat page subscribes to channel adds/renames/deletes
--              so the channel sidebar reflects changes live without polling.
-- Idempotent: skips the ADD if the table is already in the publication.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'channels'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.channels';
  END IF;
END $$;
