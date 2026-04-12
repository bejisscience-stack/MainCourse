-- Migration 195: Three-Tier Project Access Model
--
-- Replaces the binary has_project_access() gate with per-project access via
-- can_submit_to_project(uid, pid). All authenticated users can now VIEW all
-- projects, but submissions are gated per-project by three tiers:
--
--   1. Active project subscription  → all projects (1 month)
--   2. Course enrollment            → only that course's projects (lifetime)
--   3. New user (< 30 days)         → all projects
--
-- Affected tables: projects, channels, messages, project_criteria,
--                  project_submissions, submission_reviews

-- ============================================================================
-- 1. Create can_submit_to_project(uid, pid) function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_submit_to_project(uid UUID, pid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Admin bypass
  IF public.check_is_admin(uid) THEN
    RETURN TRUE;
  END IF;

  -- Tier 1: Active project subscription (all projects, 1 month)
  IF EXISTS (
    SELECT 1 FROM public.project_subscriptions
    WHERE user_id = uid
    AND status = 'active'
    AND expires_at > NOW()
  ) THEN
    RETURN TRUE;
  END IF;

  -- Tier 2: Enrolled in the project's course (lifetime access to that course's projects)
  IF EXISTS (
    SELECT 1 FROM public.enrollments e
    JOIN public.projects p ON p.course_id = e.course_id
    WHERE e.user_id = uid
    AND p.id = pid
  ) THEN
    RETURN TRUE;
  END IF;

  -- Tier 3: New user registered within the last 30 days (all projects)
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid
    AND created_at > NOW() - INTERVAL '30 days'
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Grant execute permissions (same pattern as migration 194)
GRANT EXECUTE ON FUNCTION public.can_submit_to_project(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_submit_to_project(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.can_submit_to_project(UUID, UUID) TO service_role;

-- ============================================================================
-- 2. SELECT policies: Open to ALL authenticated users (remove has_project_access)
-- ============================================================================

-- 2a. projects: view all active projects
DROP POLICY IF EXISTS "Project access users can view projects" ON public.projects;
CREATE POLICY "Authenticated users can view active projects"
  ON public.projects FOR SELECT
  USING (
    status = 'active'
    AND auth.uid() IS NOT NULL
  );

-- 2b. channels: view "projects" channel
DROP POLICY IF EXISTS "Project access users can view projects channel" ON public.channels;
CREATE POLICY "Authenticated users can view projects channel"
  ON public.channels FOR SELECT
  USING (
    LOWER(name) = 'projects'
    AND auth.uid() IS NOT NULL
  );

-- 2c. messages: view project messages
DROP POLICY IF EXISTS "Project access users can view project messages" ON public.messages;
CREATE POLICY "Authenticated users can view project messages"
  ON public.messages FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = channel_id
      AND LOWER(c.name) = 'projects'
    )
  );

-- 2d. project_criteria: view criteria
DROP POLICY IF EXISTS "Project access users can view criteria" ON public.project_criteria;
CREATE POLICY "Authenticated users can view project criteria"
  ON public.project_criteria FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 2e. project_submissions: view submissions
DROP POLICY IF EXISTS "Project access users can view submissions" ON public.project_submissions;
CREATE POLICY "Authenticated users can view project submissions"
  ON public.project_submissions FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 2f. submission_reviews: view reviews
DROP POLICY IF EXISTS "Project access users can view reviews" ON public.submission_reviews;
CREATE POLICY "Authenticated users can view submission reviews"
  ON public.submission_reviews FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- 3. INSERT policies: Use can_submit_to_project() for per-project gating
-- ============================================================================

-- 3a. project_submissions: eligible users can submit
DROP POLICY IF EXISTS "Project access users can submit" ON public.project_submissions;
CREATE POLICY "Eligible users can submit to projects"
  ON public.project_submissions FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND public.can_submit_to_project(auth.uid(), project_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.courses c ON c.id = p.course_id
      WHERE p.id = project_id
      AND (c.lecturer_id = auth.uid() OR p.user_id = auth.uid())
    )
  );

-- 3b. messages: eligible users can reply to project messages
DROP POLICY IF EXISTS "Project access users can reply to project messages" ON public.messages;
CREATE POLICY "Eligible users can reply to project messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND reply_to_id IS NOT NULL
    AND public.can_submit_to_project(
      auth.uid(),
      (SELECT p.id FROM public.projects p WHERE p.message_id = messages.reply_to_id)
    )
    AND EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = messages.channel_id
      AND LOWER(c.name) = 'projects'
    )
  );
