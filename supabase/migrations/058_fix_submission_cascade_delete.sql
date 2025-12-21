-- Migration: Fix submission cascade delete
-- Description: Prevents submissions from being deleted when their associated messages are deleted
-- This ensures submission data persists even if messages are deleted

-- Drop the existing foreign key constraint on message_id
ALTER TABLE public.project_submissions
DROP CONSTRAINT IF EXISTS project_submissions_message_id_fkey;

-- Recreate the foreign key constraint with ON DELETE RESTRICT
-- This prevents messages with submissions from being deleted
ALTER TABLE public.project_submissions
ADD CONSTRAINT project_submissions_message_id_fkey
FOREIGN KEY (message_id)
REFERENCES public.messages(id)
ON DELETE RESTRICT;

-- Note: If you need to delete a message that has a submission, you must first delete the submission
-- or update the submission to remove the message reference (if we make message_id nullable in the future)

