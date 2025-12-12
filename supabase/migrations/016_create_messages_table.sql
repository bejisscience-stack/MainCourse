-- Migration: Create messages table
-- Description: Stores chat messages for channels with proper security

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 4000),
  reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS messages_channel_id_idx ON public.messages(channel_id);
CREATE INDEX IF NOT EXISTS messages_course_id_idx ON public.messages(course_id);
CREATE INDEX IF NOT EXISTS messages_user_id_idx ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON public.messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_reply_to_idx ON public.messages(reply_to_id);

-- Policies
DROP POLICY IF EXISTS "Enrolled users can view messages" ON public.messages;
DROP POLICY IF EXISTS "Lecturers can view messages for their courses" ON public.messages;
DROP POLICY IF EXISTS "Enrolled users can insert messages" ON public.messages;
DROP POLICY IF EXISTS "Lecturers can insert messages for their courses" ON public.messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;
DROP POLICY IF EXISTS "Lecturers can delete messages in their courses" ON public.messages;

-- Enrolled users can view messages
CREATE POLICY "Enrolled users can view messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE enrollments.course_id = messages.course_id
      AND enrollments.user_id = auth.uid()
    )
  );

-- Lecturers can view messages for their courses
CREATE POLICY "Lecturers can view messages for their courses"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = messages.course_id
      AND courses.lecturer_id = auth.uid()
    )
  );

-- Enrolled users can insert messages
CREATE POLICY "Enrolled users can insert messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE enrollments.course_id = messages.course_id
      AND enrollments.user_id = auth.uid()
    )
  );

-- Lecturers can insert messages for their courses
CREATE POLICY "Lecturers can insert messages for their courses"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = messages.course_id
      AND courses.lecturer_id = auth.uid()
    )
  );

-- Users can update their own messages
CREATE POLICY "Users can update their own messages"
  ON public.messages FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own messages
CREATE POLICY "Users can delete their own messages"
  ON public.messages FOR DELETE
  USING (auth.uid() = user_id);

-- Lecturers can delete messages in their courses
CREATE POLICY "Lecturers can delete messages in their courses"
  ON public.messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = messages.course_id
      AND courses.lecturer_id = auth.uid()
    )
  );

-- Trigger to update updated_at
CREATE TRIGGER on_message_updated
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable Realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;




