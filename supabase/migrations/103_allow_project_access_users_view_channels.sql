-- Allow users with active project access to view channels
-- (via 1-month free grant OR active project subscription)
CREATE POLICY "Project access users can view channels"
  ON public.channels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.project_access_expires_at > now()
    )
    OR EXISTS (
      SELECT 1 FROM public.project_subscriptions
      WHERE project_subscriptions.user_id = auth.uid()
      AND project_subscriptions.status = 'active'
      AND project_subscriptions.expires_at > now()
    )
  );
