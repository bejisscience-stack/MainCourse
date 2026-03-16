-- Migration 138: Project budget payment via Keepz
--
-- When a lecturer creates a project with budget > 0, they must pay via Keepz.
-- Project is created with status='pending_payment', then set to 'active' on payment success.
--
-- Changes:
-- a) Add status column to projects table
-- b) Extend keepz_payments.payment_type to include 'project_budget'
-- c) Update projects RLS SELECT policies to hide pending_payment from non-owners

-- ---------------------------------------------------------------------------
-- a) Add status column to projects
-- ---------------------------------------------------------------------------

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('pending_payment', 'active'));

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);

-- ---------------------------------------------------------------------------
-- b) Extend keepz_payments.payment_type CHECK constraint
-- ---------------------------------------------------------------------------

-- Drop existing CHECK and re-add with 'project_budget'
ALTER TABLE keepz_payments DROP CONSTRAINT IF EXISTS keepz_payments_payment_type_check;
ALTER TABLE keepz_payments ADD CONSTRAINT keepz_payments_payment_type_check
  CHECK (payment_type IN ('course_enrollment', 'project_subscription', 'bundle_enrollment', 'project_budget'));

-- ---------------------------------------------------------------------------
-- c) Update projects RLS: hide pending_payment from non-owners
-- ---------------------------------------------------------------------------

-- Policy 1 (from migration 050): enrolled users + lecturer
DROP POLICY IF EXISTS "Users can view projects in enrolled courses" ON public.projects;
CREATE POLICY "Users can view projects in enrolled courses"
  ON public.projects FOR SELECT
  USING (
    status = 'active'
    AND (
      EXISTS (
        SELECT 1 FROM public.enrollments e
        WHERE e.course_id = projects.course_id
        AND e.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = projects.course_id
        AND c.lecturer_id = auth.uid()
      )
    )
  );

-- Policy 2 (from migration 076): anyone can view date-active projects
DROP POLICY IF EXISTS "Anyone can view active projects" ON public.projects;
CREATE POLICY "Anyone can view active projects"
  ON public.projects FOR SELECT
  USING (
    status = 'active'
    AND start_date IS NOT NULL
    AND end_date IS NOT NULL
    AND CURRENT_DATE >= start_date
    AND CURRENT_DATE <= end_date
  );

-- Policy 3 (from migration 104): project access users
DROP POLICY IF EXISTS "Project access users can view projects" ON public.projects;
CREATE POLICY "Project access users can view projects"
  ON public.projects FOR SELECT
  USING (
    status = 'active'
    AND has_project_access(auth.uid())
  );

-- New policy: project creators always see their own projects (including pending_payment)
DROP POLICY IF EXISTS "Project creators can view own projects" ON public.projects;
CREATE POLICY "Project creators can view own projects"
  ON public.projects FOR SELECT
  USING (user_id = auth.uid());
