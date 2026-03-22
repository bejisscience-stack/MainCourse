-- Migration: Include course lecturer in unread message counts
-- Problem: update_unread_counts() and update_unread_counts_on_video() only
-- query the enrollments table, so lecturers (who are in courses.lecturer_id,
-- not enrollments) never receive unread count increments.

-- Fix: UNION the lecturer with enrolled users in both trigger functions.

CREATE OR REPLACE FUNCTION update_unread_counts()
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
  WHERE recipient.user_id != NEW.user_id
  ON CONFLICT (channel_id, user_id)
  DO UPDATE SET
    unread_count = unread_messages.unread_count + 1,
    updated_at = TIMEZONE('utc', NOW());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
  WHERE recipient.user_id != NEW.user_id
  ON CONFLICT (channel_id, user_id)
  DO UPDATE SET
    unread_count = unread_messages.unread_count + 1,
    updated_at = TIMEZONE('utc', NOW());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
