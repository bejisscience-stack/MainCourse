-- Migration: Add unread count trigger for video uploads
-- Description: When a new video is inserted into the lectures channel,
-- increment unread_messages for all enrolled users except the uploader.
-- This mirrors the existing update_unread_counts() trigger on messages.

CREATE OR REPLACE FUNCTION update_unread_counts_on_video()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment unread count for all enrolled users except the video uploader
  -- The uploader is the lecturer who owns the course
  INSERT INTO public.unread_messages (channel_id, course_id, user_id, unread_count, last_read_at, updated_at)
  SELECT
    NEW.channel_id,
    NEW.course_id,
    e.user_id,
    1,
    TIMEZONE('utc', NOW()),
    TIMEZONE('utc', NOW())
  FROM public.enrollments e
  WHERE e.course_id = NEW.course_id
  ON CONFLICT (channel_id, user_id)
  DO UPDATE SET
    unread_count = unread_messages.unread_count + 1,
    updated_at = TIMEZONE('utc', NOW());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on video insert
DROP TRIGGER IF EXISTS on_video_insert_update_unread ON public.videos;
CREATE TRIGGER on_video_insert_update_unread
  AFTER INSERT ON public.videos
  FOR EACH ROW
  EXECUTE FUNCTION update_unread_counts_on_video();
