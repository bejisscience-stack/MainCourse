-- Allow standalone project owners (projects.user_id) to view and manage
-- submission_reviews. Course-bound lecturer policies from mig 053 remain
-- unchanged; these policies are additive (OR'd by Postgres RLS).

DROP POLICY IF EXISTS "project_owner_view_reviews" ON public.submission_reviews;
CREATE POLICY "project_owner_view_reviews"
  ON public.submission_reviews FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = submission_reviews.project_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "project_owner_create_reviews" ON public.submission_reviews;
CREATE POLICY "project_owner_create_reviews"
  ON public.submission_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = lecturer_id
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = submission_reviews.project_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "project_owner_update_reviews" ON public.submission_reviews;
CREATE POLICY "project_owner_update_reviews"
  ON public.submission_reviews FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = lecturer_id
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = submission_reviews.project_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = lecturer_id
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = submission_reviews.project_id
        AND p.user_id = auth.uid()
    )
  );
