-- Migration 164: Fix project visibility timezone
--
-- The "Anyone can view active projects" RLS policy used CURRENT_DATE (UTC),
-- but project dates are set in Georgia timezone (UTC+4). This caused a 4-hour
-- window where projects appeared/disappeared at the wrong time.
--
-- Fix: use (NOW() AT TIME ZONE 'Asia/Tbilisi')::date instead of CURRENT_DATE.

-- Update the "Anyone can view active projects" policy
DROP POLICY IF EXISTS "Anyone can view active projects" ON public.projects;
CREATE POLICY "Anyone can view active projects"
  ON public.projects FOR SELECT
  USING (
    status = 'active'
    AND start_date IS NOT NULL
    AND end_date IS NOT NULL
    AND (NOW() AT TIME ZONE 'Asia/Tbilisi')::date >= start_date
    AND (NOW() AT TIME ZONE 'Asia/Tbilisi')::date <= end_date
  );
