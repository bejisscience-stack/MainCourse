-- Enable Realtime for admin analytics source tables.
-- Existing approval/payment tables are already published by earlier migrations;
-- this migration covers the remaining tables that drive admin metrics.

DO $$
DECLARE
  table_name TEXT;
  tables TEXT[] := ARRAY[
    'referrals',
    'projects',
    'project_submissions',
    'submission_reviews',
    'enrollments',
    'balance_transactions',
    'courses',
    'course_bundles',
    'coming_soon_emails',
    'email_send_history',
    'platform_settings'
  ];
BEGIN
  FOREACH table_name IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = table_name
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
    END IF;
  END LOOP;
END $$;
