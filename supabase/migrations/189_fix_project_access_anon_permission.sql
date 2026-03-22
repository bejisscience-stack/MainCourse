-- Migration 189: Fix "permission denied for function has_project_access" for anon users
--
-- Root cause: Migration 176 revoked EXECUTE on has_project_access() from anon.
-- RLS SELECT policies calling has_project_access(auth.uid()) error instead of
-- returning FALSE for anon users, because PostgreSQL evaluates ALL policies and
-- a permission error kills the entire query.
--
-- Fix: Add `auth.uid() IS NOT NULL` guard before has_project_access() calls.
-- This short-circuits to FALSE for anon without calling the restricted function.
--
-- Affected tables: projects, channels, messages, project_criteria,
--                  project_submissions, submission_reviews

-- ============================================================================
-- 1. projects: "Project access users can view projects"
--    Source: migration 138 line 69-74
-- ============================================================================

DROP POLICY IF EXISTS "Project access users can view projects" ON public.projects;
CREATE POLICY "Project access users can view projects"
  ON public.projects FOR SELECT
  USING (
    status = 'active'
    AND auth.uid() IS NOT NULL
    AND has_project_access(auth.uid())
  );

-- ============================================================================
-- 2. channels: "Project access users can view projects channel"
--    Source: migration 104 line 145-150
-- ============================================================================

DROP POLICY IF EXISTS "Project access users can view projects channel" ON public.channels;
CREATE POLICY "Project access users can view projects channel"
  ON public.channels FOR SELECT
  USING (
    LOWER(name) = 'projects'
    AND auth.uid() IS NOT NULL
    AND has_project_access(auth.uid())
  );

-- ============================================================================
-- 3. messages: "Project access users can view project messages"
--    Source: migration 104 line 153-162
-- ============================================================================

DROP POLICY IF EXISTS "Project access users can view project messages" ON public.messages;
CREATE POLICY "Project access users can view project messages"
  ON public.messages FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND has_project_access(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = channel_id
      AND LOWER(c.name) = 'projects'
    )
  );

-- ============================================================================
-- 4. project_criteria: "Project access users can view criteria"
--    Source: migration 104 line 189-191
-- ============================================================================

DROP POLICY IF EXISTS "Project access users can view criteria" ON public.project_criteria;
CREATE POLICY "Project access users can view criteria"
  ON public.project_criteria FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND has_project_access(auth.uid())
  );

-- ============================================================================
-- 5. project_submissions: "Project access users can view submissions"
--    Source: migration 104 line 170-172
-- ============================================================================

DROP POLICY IF EXISTS "Project access users can view submissions" ON public.project_submissions;
CREATE POLICY "Project access users can view submissions"
  ON public.project_submissions FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND has_project_access(auth.uid())
  );

-- ============================================================================
-- 6. project_submissions: "Project access users can submit"
--    Source: migration 104 line 175-186
-- ============================================================================

DROP POLICY IF EXISTS "Project access users can submit" ON public.project_submissions;
CREATE POLICY "Project access users can submit"
  ON public.project_submissions FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND has_project_access(auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.courses c ON c.id = p.course_id
      WHERE p.id = project_id
      AND (c.lecturer_id = auth.uid() OR p.user_id = auth.uid())
    )
  );

-- ============================================================================
-- 7. submission_reviews: "Project access users can view reviews"
--    Source: migration 104 line 194-196
-- ============================================================================

DROP POLICY IF EXISTS "Project access users can view reviews" ON public.submission_reviews;
CREATE POLICY "Project access users can view reviews"
  ON public.submission_reviews FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND has_project_access(auth.uid())
  );

-- ============================================================================
-- 8. messages: "Project access users can reply to project messages"
--    Source: migration 104_allow_project_access_users_reply_to_projects
-- ============================================================================

DROP POLICY IF EXISTS "Project access users can reply to project messages" ON public.messages;
CREATE POLICY "Project access users can reply to project messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND reply_to_id IS NOT NULL
    AND has_project_access(auth.uid())
    AND EXISTS (
      SELECT 1 FROM projects p WHERE p.message_id = messages.reply_to_id
    )
    AND EXISTS (
      SELECT 1 FROM channels c WHERE c.id = messages.channel_id AND lower(c.name) = 'projects'
    )
  );
