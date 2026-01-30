-- Migration: Add performance indexes for frequently queried fields
-- Description: Creates indexes to improve query performance identified in performance audit
-- Note: Some indexes may already exist from previous migrations (using IF NOT EXISTS for safety)

-- Composite index for messages queries (channel_id + created_at for ordering)
-- This optimizes the common query pattern: WHERE channel_id = X ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS messages_channel_created_idx ON public.messages(channel_id, created_at DESC);

-- Index for messages.created_at (used for pagination and ordering)
-- Additional index for queries that only order by created_at
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON public.messages(created_at DESC);

-- Index for message_attachments.message_id (for efficient attachment lookups)
-- Optimizes: SELECT * FROM message_attachments WHERE message_id IN (...)
CREATE INDEX IF NOT EXISTS message_attachments_message_id_idx ON public.message_attachments(message_id);

-- Index for bundle_enrollments.user_id (for efficient bundle enrollment checks)
-- Optimizes: SELECT bundle_id FROM bundle_enrollments WHERE user_id = X
CREATE INDEX IF NOT EXISTS bundle_enrollments_user_id_idx ON public.bundle_enrollments(user_id);

-- Index for courses.lecturer_id (queried in multiple places)
-- Optimizes: SELECT * FROM courses WHERE lecturer_id = X
CREATE INDEX IF NOT EXISTS courses_lecturer_id_idx ON public.courses(lecturer_id);

-- Note: The following indexes already exist from previous migrations:
-- - channels_course_id_idx (migration 013)
-- - enrollments_user_course_idx (migration 011, unique index)
-- - profiles_username_idx (migration 019, unique index)

