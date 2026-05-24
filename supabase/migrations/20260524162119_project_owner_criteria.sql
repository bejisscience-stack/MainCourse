-- Allow standalone project owners (projects.user_id) to insert, update, and
-- delete rows in project_criteria. Course-bound lecturer policies from mig 052
-- remain unchanged; these policies are additive (Postgres RLS evaluates
-- permissive policies with OR).
--
-- Background: mig 052 INSERT/UPDATE/DELETE policies require a JOIN to courses
-- on courses.lecturer_id = auth.uid(). Standalone projects have course_id
-- NULL, so the JOIN returns zero rows and standalone owners cannot author
-- their own criteria — leaving every review's payment_amount stuck at 0 and
-- breaking the admin View Bot's RPM calculations. See mig 247 for the
-- equivalent pattern applied to submission_reviews.
--
-- SELECT policies are intentionally untouched: migs 076, 104, 189 already
-- grant broad SELECT coverage (active projects, project-access users,
-- authenticated users), so creators can already read criteria.

DROP POLICY IF EXISTS "project_owner_create_criteria" ON public.project_criteria;
CREATE POLICY "project_owner_create_criteria"
  ON public.project_criteria FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_criteria.project_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "project_owner_update_criteria" ON public.project_criteria;
CREATE POLICY "project_owner_update_criteria"
  ON public.project_criteria FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_criteria.project_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_criteria.project_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "project_owner_delete_criteria" ON public.project_criteria;
CREATE POLICY "project_owner_delete_criteria"
  ON public.project_criteria FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_criteria.project_id
        AND p.user_id = auth.uid()
    )
  );
