-- Fix: Admin users can send chat messages with attachments.
-- Migration 132 added admin INSERT on messages but missed message_attachments.
CREATE POLICY "Admins can insert message attachments"
  ON public.message_attachments FOR INSERT
  WITH CHECK (check_is_admin(auth.uid()));
