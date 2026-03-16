-- Migration: Add spent tracking column to projects table
-- Description: Tracks how much of the project budget has been spent on student payouts.
-- remaining_budget = budget - spent

-- Step 1: Add spent column
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS spent DECIMAL(10, 2) DEFAULT 0 CHECK (spent >= 0);

COMMENT ON COLUMN public.projects.spent IS 'Total amount paid out to students from this project budget. Remaining = budget - spent.';

-- Step 2: Allow admins to update projects (for spent tracking)
DROP POLICY IF EXISTS "Admins can update projects" ON public.projects;
CREATE POLICY "Admins can update projects"
  ON public.projects FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
