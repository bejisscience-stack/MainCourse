-- Migration: Create typing_indicators table
-- Description: Tracks typing indicators for real-time chat

CREATE TABLE IF NOT EXISTS public.typing_indicators (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  expires_at TIMESTAMPTZ DEFAULT (TIMEZONE('utc', NOW()) + INTERVAL '3 seconds') NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE(channel_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.typing_indicators ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS typing_indicators_channel_id_idx ON public.typing_indicators(channel_id);
CREATE INDEX IF NOT EXISTS typing_indicators_user_id_idx ON public.typing_indicators(user_id);
CREATE INDEX IF NOT EXISTS typing_indicators_expires_at_idx ON public.typing_indicators(expires_at);

-- Policies
DROP POLICY IF EXISTS "Enrolled users can view typing indicators" ON public.typing_indicators;
DROP POLICY IF EXISTS "Lecturers can view typing indicators for their courses" ON public.typing_indicators;
DROP POLICY IF EXISTS "Users can insert their own typing indicators" ON public.typing_indicators;
DROP POLICY IF EXISTS "Users can update their own typing indicators" ON public.typing_indicators;
DROP POLICY IF EXISTS "Users can delete their own typing indicators" ON public.typing_indicators;

-- Enrolled users can view typing indicators
CREATE POLICY "Enrolled users can view typing indicators"
  ON public.typing_indicators FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.channels
      JOIN public.enrollments ON enrollments.course_id = channels.course_id
      WHERE channels.id = typing_indicators.channel_id
      AND enrollments.user_id = auth.uid()
    )
  );

-- Lecturers can view typing indicators for their courses
CREATE POLICY "Lecturers can view typing indicators for their courses"
  ON public.typing_indicators FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.channels
      JOIN public.courses ON courses.id = channels.course_id
      WHERE channels.id = typing_indicators.channel_id
      AND courses.lecturer_id = auth.uid()
    )
  );

-- Users can insert their own typing indicators
CREATE POLICY "Users can insert their own typing indicators"
  ON public.typing_indicators FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.channels
      JOIN public.enrollments ON enrollments.course_id = channels.course_id
      WHERE channels.id = typing_indicators.channel_id
      AND enrollments.user_id = auth.uid()
    )
  );

-- Lecturers can insert typing indicators for their courses
CREATE POLICY "Lecturers can insert typing indicators for their courses"
  ON public.typing_indicators FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.channels
      JOIN public.courses ON courses.id = channels.course_id
      WHERE channels.id = typing_indicators.channel_id
      AND courses.lecturer_id = auth.uid()
    )
  );

-- Users can update their own typing indicators
CREATE POLICY "Users can update their own typing indicators"
  ON public.typing_indicators FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own typing indicators
CREATE POLICY "Users can delete their own typing indicators"
  ON public.typing_indicators FOR DELETE
  USING (auth.uid() = user_id);

-- Enable Realtime for typing indicators
ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_indicators;

-- Function to clean up expired typing indicators
CREATE OR REPLACE FUNCTION public.cleanup_expired_typing_indicators()
RETURNS void AS $$
BEGIN
  DELETE FROM public.typing_indicators
  WHERE expires_at < TIMEZONE('utc', NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
