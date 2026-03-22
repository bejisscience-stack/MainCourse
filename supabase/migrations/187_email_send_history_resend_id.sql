-- Migration 187: Add resend_message_id to email_send_history
-- Stores the Resend API message ID so we can look up delivery status

ALTER TABLE public.email_send_history
  ADD COLUMN IF NOT EXISTS resend_message_id TEXT;

CREATE INDEX IF NOT EXISTS idx_email_send_history_resend_id
  ON public.email_send_history(resend_message_id)
  WHERE resend_message_id IS NOT NULL;
