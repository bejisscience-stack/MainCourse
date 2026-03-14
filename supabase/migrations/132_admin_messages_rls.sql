-- Migration: Add admin RLS policies for messages and message_attachments
-- Description: Admins could not see any chat messages because no admin SELECT/INSERT
-- policies existed on the messages table. Channels and videos had admin policies
-- (migrations 033/037) but messages were missed.

-- Admin can view all messages
DROP POLICY IF EXISTS "Admins can view all messages" ON public.messages;
CREATE POLICY "Admins can view all messages"
  ON public.messages FOR SELECT
  USING (check_is_admin(auth.uid()));

-- Admin can post in any channel
DROP POLICY IF EXISTS "Admins can insert messages" ON public.messages;
CREATE POLICY "Admins can insert messages"
  ON public.messages FOR INSERT
  WITH CHECK (check_is_admin(auth.uid()));

-- Admin can delete any message (moderation)
DROP POLICY IF EXISTS "Admins can delete any message" ON public.messages;
CREATE POLICY "Admins can delete any message"
  ON public.messages FOR DELETE
  USING (check_is_admin(auth.uid()));

-- Admin can view all message attachments
DROP POLICY IF EXISTS "Admins can view all message attachments" ON public.message_attachments;
CREATE POLICY "Admins can view all message attachments"
  ON public.message_attachments FOR SELECT
  USING (check_is_admin(auth.uid()));
