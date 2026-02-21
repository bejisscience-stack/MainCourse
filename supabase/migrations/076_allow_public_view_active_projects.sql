-- Migration: Allow public viewing of active projects
-- Description: Adds RLS policy to allow anyone to view projects that are currently active
-- (have start_date and end_date set, and current date is between them)

-- Drop existing policy if it exists (for idempotency)
DROP POLICY IF EXISTS "Anyone can view active projects" ON public.projects;

-- Create policy to allow anyone to view active projects
-- Active projects are those where:
-- 1. start_date is not null
-- 2. end_date is not null
-- 3. current date is between start_date and end_date
CREATE POLICY "Anyone can view active projects"
  ON public.projects FOR SELECT
  USING (
    start_date IS NOT NULL
    AND end_date IS NOT NULL
    AND CURRENT_DATE >= start_date
    AND CURRENT_DATE <= end_date
  );

-- Also allow public viewing of project criteria for active projects
DROP POLICY IF EXISTS "Anyone can view criteria for active projects" ON public.project_criteria;

CREATE POLICY "Anyone can view criteria for active projects"
  ON public.project_criteria FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_criteria.project_id
      AND p.start_date IS NOT NULL
      AND p.end_date IS NOT NULL
      AND CURRENT_DATE >= p.start_date
      AND CURRENT_DATE <= p.end_date
    )
  );
