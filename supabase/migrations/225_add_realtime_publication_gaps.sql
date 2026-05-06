-- Migration: Close realtime publication gaps
-- Description: Adds tables that the client already assumes are published
--              (project_criteria) and tables we want to stop polling
--              (kyc_submissions). Idempotent: skips ADD when the table is
--              already in the publication.

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'project_criteria',
    'kyc_submissions'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
