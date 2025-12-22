-- Migration: Delete "Video submission" messages
-- Description: Removes all messages with content "Video submission" from the database

-- Delete messages with content "Video submission"
-- Note: This will also delete associated records in project_submissions that reference these messages
-- via CASCADE if there are foreign key constraints, or we may need to handle them separately

-- First, let's check if there are any project_submissions referencing these messages
-- and handle them appropriately

-- Delete project_submissions that reference "Video submission" messages
DELETE FROM public.project_submissions
WHERE message_id IN (
  SELECT id FROM public.messages
  WHERE content = 'Video submission'
);

-- Now delete the messages themselves
DELETE FROM public.messages
WHERE content = 'Video submission';

-- Optional: Show count of deleted messages (for verification)
-- SELECT COUNT(*) as deleted_count FROM public.messages WHERE content = 'Video submission';
-- (This will return 0 after deletion)



