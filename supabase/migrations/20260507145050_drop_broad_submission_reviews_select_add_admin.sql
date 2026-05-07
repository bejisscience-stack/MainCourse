-- Audit A-9: drop the broad PERMISSIVE SELECT on public.submission_reviews
-- and add a role-checked admin SELECT so admin realtime channels and any
-- direct admin PostgREST reads keep working. Server-side admin endpoints
-- already use service-role and bypass RLS — they are unaffected.
--
-- Before this migration, two SELECT policies coexisted:
--   * "Authenticated users can view submission reviews"  qual: auth.uid() IS NOT NULL  (broad — every authed user)
--   * "Users can view reviews in enrolled courses"       qual: enrollments OR courses.lecturer_id (intended)
-- PERMISSIVE policies are OR'd, so the broad one made every authed user
-- see every review. We drop the broad one and keep the narrower one,
-- adding an explicit admin SELECT for admin UI realtime parity.

DROP POLICY IF EXISTS "Authenticated users can view submission reviews"
  ON public.submission_reviews;

DROP POLICY IF EXISTS "Admins can view all submission reviews"
  ON public.submission_reviews;

CREATE POLICY "Admins can view all submission reviews"
  ON public.submission_reviews FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = 'admin'
    )
  );
