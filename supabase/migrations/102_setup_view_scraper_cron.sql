-- ============================================================
-- Migration 102: View Scraper Cron Job
--
-- PREREQUISITES: Enable pg_cron and pg_net extensions in Supabase Dashboard
-- (Database → Extensions → search for pg_cron and pg_net → Enable)
--
-- Run this migration AFTER enabling the extensions.
-- ============================================================

-- Schedule daily scrape at 3:00 AM UTC
SELECT cron.schedule(
  'daily-view-scrape',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/view-scraper',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-scraper-secret', current_setting('app.settings.view_scraper_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
