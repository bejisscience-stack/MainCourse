-- Migration: Create message_attachments table
-- Description: Stores media attachments (images, videos, GIFs) for messages

CREATE TABLE IF NOT EXISTS public.message_attachments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('image', 'video', 'gif')),
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS message_attachments_message_id_idx ON public.message_attachments(message_id);
CREATE INDEX IF NOT EXISTS message_attachments_channel_id_idx ON public.message_attachments(channel_id);
CREATE INDEX IF NOT EXISTS message_attachments_course_id_idx ON public.message_attachments(course_id);

-- Policies
DROP POLICY IF EXISTS "Enrolled users can view attachments" ON public.message_attachments;
DROP POLICY IF EXISTS "Lecturers can view attachments for their courses" ON public.message_attachments;
DROP POLICY IF EXISTS "Enrolled users can insert attachments" ON public.message_attachments;
DROP POLICY IF EXISTS "Lecturers can insert attachments for their courses" ON public.message_attachments;
DROP POLICY IF EXISTS "Users can delete their own attachments" ON public.message_attachments;
DROP POLICY IF EXISTS "Lecturers can delete attachments in their courses" ON public.message_attachments;

-- Enrolled users can view attachments
CREATE POLICY "Enrolled users can view attachments"
  ON public.message_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE enrollments.course_id = message_attachments.course_id
      AND enrollments.user_id = auth.uid()
    )
  );

-- Lecturers can view attachments for their courses
CREATE POLICY "Lecturers can view attachments for their courses"
  ON public.message_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = message_attachments.course_id
      AND courses.lecturer_id = auth.uid()
    )
  );

-- Enrolled users can insert attachments (for their own messages)
CREATE POLICY "Enrolled users can insert attachments"
  ON public.message_attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.messages
      WHERE messages.id = message_attachments.message_id
      AND messages.user_id = auth.uid()
    ) AND
    EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE enrollments.course_id = message_attachments.course_id
      AND enrollments.user_id = auth.uid()
    )
  );

-- Lecturers can insert attachments for their courses
CREATE POLICY "Lecturers can insert attachments for their courses"
  ON public.message_attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.messages
      WHERE messages.id = message_attachments.message_id
      AND messages.user_id = auth.uid()
    ) AND
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = message_attachments.course_id
      AND courses.lecturer_id = auth.uid()
    )
  );

-- Users can delete their own attachments
CREATE POLICY "Users can delete their own attachments"
  ON public.message_attachments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.messages
      WHERE messages.id = message_attachments.message_id
      AND messages.user_id = auth.uid()
    )
  );

-- Lecturers can delete attachments in their courses
CREATE POLICY "Lecturers can delete attachments in their courses"
  ON public.message_attachments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = message_attachments.course_id
      AND courses.lecturer_id = auth.uid()
    )
  );















