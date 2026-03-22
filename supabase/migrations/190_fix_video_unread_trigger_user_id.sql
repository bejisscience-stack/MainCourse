-- Migration: Fix update_unread_counts_on_video() referencing non-existent NEW.user_id
-- Problem: The videos table has no user_id column, so INSERT on videos fails with:
--   "record 'new' has no field 'user_id'"
-- Fix: Look up the course lecturer_id from the courses table instead.
--   Only lecturers can insert videos (enforced by RLS), so excluding
--   the lecturer is equivalent to excluding the uploader.

CREATE OR REPLACE FUNCTION update_unread_counts_on_video()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.unread_messages (channel_id, course_id, user_id, unread_count, last_read_at, updated_at)
  SELECT
    NEW.channel_id,
    NEW.course_id,
    recipient.user_id,
    1,
    TIMEZONE('utc', NOW()),
    TIMEZONE('utc', NOW())
  FROM (
    -- Enrolled students
    SELECT e.user_id FROM public.enrollments e
    WHERE e.course_id = NEW.course_id
    UNION
    -- Course lecturer
    SELECT c.lecturer_id FROM public.courses c
    WHERE c.id = NEW.course_id AND c.lecturer_id IS NOT NULL
  ) recipient
  WHERE recipient.user_id != (
    SELECT c.lecturer_id FROM public.courses c WHERE c.id = NEW.course_id
  )
  ON CONFLICT (channel_id, user_id)
  DO UPDATE SET
    unread_count = unread_messages.unread_count + 1,
    updated_at = TIMEZONE('utc', NOW());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
