-- FIX 6: Add enrollment expiry check to RLS SELECT policy
-- Filters out expired enrollments at the database level.
-- expires_at IS NULL covers lifetime enrollments.

DROP POLICY IF EXISTS "Users can view own enrollments" ON enrollments;

CREATE POLICY "Users can view own enrollments"
  ON enrollments
  FOR SELECT
  USING (
    auth.uid() = user_id
    AND (expires_at IS NULL OR expires_at > NOW())
  );
