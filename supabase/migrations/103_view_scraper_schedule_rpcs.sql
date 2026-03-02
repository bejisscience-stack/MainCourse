-- Migration: View Scraper Schedule RPCs
-- Provides admin-only RPC wrappers around pg_cron job management
-- since the cron schema is not accessible via PostgREST/Supabase client

-- Get current schedule for the view scraper cron job
CREATE OR REPLACE FUNCTION public.get_view_scraper_schedule()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  result jsonb;
  admin_check boolean;
BEGIN
  -- Admin-only check
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ) INTO admin_check;

  IF NOT admin_check THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  SELECT jsonb_build_object(
    'jobid', j.jobid,
    'jobname', j.jobname,
    'schedule', j.schedule,
    'active', j.active
  )
  INTO result
  FROM cron.job j
  WHERE j.jobname = 'daily-view-scrape';

  IF result IS NULL THEN
    RETURN jsonb_build_object(
      'jobid', null,
      'jobname', 'daily-view-scrape',
      'schedule', null,
      'active', false
    );
  END IF;

  RETURN result;
END;
$$;

-- Update schedule and/or active state for the view scraper cron job
CREATE OR REPLACE FUNCTION public.update_view_scraper_schedule(
  p_schedule text DEFAULT NULL,
  p_active boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  job_id bigint;
  admin_check boolean;
BEGIN
  -- Admin-only check
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ) INTO admin_check;

  IF NOT admin_check THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  -- Get the job ID
  SELECT j.jobid INTO job_id
  FROM cron.job j
  WHERE j.jobname = 'daily-view-scrape';

  IF job_id IS NULL THEN
    RAISE EXCEPTION 'Cron job "daily-view-scrape" not found';
  END IF;

  -- Update schedule if provided
  IF p_schedule IS NOT NULL THEN
    PERFORM cron.alter_job(
      job_id := job_id,
      schedule := p_schedule
    );
  END IF;

  -- Update active state if provided
  IF p_active IS NOT NULL THEN
    UPDATE cron.job SET active = p_active WHERE jobid = job_id;
  END IF;

  -- Return updated state
  RETURN public.get_view_scraper_schedule();
END;
$$;

-- Grant execute to authenticated users (RPC auth check handles admin gating)
GRANT EXECUTE ON FUNCTION public.get_view_scraper_schedule() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_view_scraper_schedule(text, boolean) TO authenticated;
