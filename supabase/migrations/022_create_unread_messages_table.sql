-- Migration: Create unread_messages table
-- Description: Tracks unread message counts per channel per user

CREATE TABLE IF NOT EXISTS public.unread_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  last_read_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  unread_count INTEGER DEFAULT 0 NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE(channel_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.unread_messages ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS unread_messages_channel_id_idx ON public.unread_messages(channel_id);
CREATE INDEX IF NOT EXISTS unread_messages_course_id_idx ON public.unread_messages(course_id);
CREATE INDEX IF NOT EXISTS unread_messages_user_id_idx ON public.unread_messages(user_id);
CREATE INDEX IF NOT EXISTS unread_messages_user_channel_idx ON public.unread_messages(user_id, channel_id);

-- Policies
DROP POLICY IF EXISTS "Users can view their own unread counts" ON public.unread_messages;
DROP POLICY IF EXISTS "Users can update their own unread counts" ON public.unread_messages;
DROP POLICY IF EXISTS "Users can insert their own unread counts" ON public.unread_messages;

-- Users can view their own unread counts
CREATE POLICY "Users can view their own unread counts"
  ON public.unread_messages FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own unread counts
CREATE POLICY "Users can update their own unread counts"
  ON public.unread_messages FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can insert their own unread counts
CREATE POLICY "Users can insert their own unread counts"
  ON public.unread_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Function to update unread count when a new message is inserted
CREATE OR REPLACE FUNCTION update_unread_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment unread count for all users in the channel except the sender
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
    AND e.user_id != NEW.user_id
  ON CONFLICT (channel_id, user_id) 
  DO UPDATE SET
    unread_count = unread_messages.unread_count + 1,
    updated_at = TIMEZONE('utc', NOW());
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update unread counts on message insert
DROP TRIGGER IF EXISTS on_message_insert_update_unread ON public.messages;
CREATE TRIGGER on_message_insert_update_unread
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION update_unread_counts();

-- Function to reset unread count when user opens channel
CREATE OR REPLACE FUNCTION reset_unread_count(p_channel_id UUID, p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.unread_messages
  SET 
    unread_count = 0,
    last_read_at = TIMEZONE('utc', NOW()),
    updated_at = TIMEZONE('utc', NOW())
  WHERE channel_id = p_channel_id
    AND user_id = p_user_id;
  
  -- If no row exists, create one
  IF NOT FOUND THEN
    INSERT INTO public.unread_messages (channel_id, course_id, user_id, unread_count, last_read_at, updated_at)
    SELECT 
      p_channel_id,
      c.course_id,
      p_user_id,
      0,
      TIMEZONE('utc', NOW()),
      TIMEZONE('utc', NOW())
    FROM public.channels c
    WHERE c.id = p_channel_id
    ON CONFLICT (channel_id, user_id) DO UPDATE SET
      unread_count = 0,
      last_read_at = TIMEZONE('utc', NOW()),
      updated_at = TIMEZONE('utc', NOW());
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;



