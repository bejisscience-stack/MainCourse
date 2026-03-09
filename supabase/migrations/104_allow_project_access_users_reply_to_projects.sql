-- Allow users with project access (free 1-month grant OR active subscription)
-- to reply to project messages in the 'projects' channel
CREATE POLICY "Project access users can reply to project messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND reply_to_id IS NOT NULL
    AND has_project_access(auth.uid())
    AND EXISTS (
      SELECT 1 FROM projects p WHERE p.message_id = messages.reply_to_id
    )
    AND EXISTS (
      SELECT 1 FROM channels c WHERE c.id = messages.channel_id AND lower(c.name) = 'projects'
    )
  );
