-- Migration: Create channels table
-- Description: Stores channels for courses (text, voice, lectures)

CREATE TABLE IF NOT EXISTS public.channels (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'voice', 'lectures')),
  description TEXT,
  category_name TEXT DEFAULT 'COURSE CHANNELS',
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE(course_id, name)
);

-- Enable Row Level Security
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS channels_course_id_idx ON public.channels(course_id);
CREATE INDEX IF NOT EXISTS channels_type_idx ON public.channels(type);
CREATE INDEX IF NOT EXISTS channels_display_order_idx ON public.channels(course_id, display_order);

-- Policies
DROP POLICY IF EXISTS "Lecturers can view channels for their courses" ON public.channels;
DROP POLICY IF EXISTS "Lecturers can create channels for their courses" ON public.channels;
DROP POLICY IF EXISTS "Lecturers can update channels for their courses" ON public.channels;
DROP POLICY IF EXISTS "Lecturers can delete channels for their courses" ON public.channels;
DROP POLICY IF EXISTS "Enrolled users can view channels" ON public.channels;

-- Lecturers can manage channels for their courses
CREATE POLICY "Lecturers can view channels for their courses"
  ON public.channels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = channels.course_id
      AND courses.lecturer_id = auth.uid()
    )
  );

CREATE POLICY "Lecturers can create channels for their courses"
  ON public.channels FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = channels.course_id
      AND courses.lecturer_id = auth.uid()
    )
  );

CREATE POLICY "Lecturers can update channels for their courses"
  ON public.channels FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = channels.course_id
      AND courses.lecturer_id = auth.uid()
    )
  );

CREATE POLICY "Lecturers can delete channels for their courses"
  ON public.channels FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = channels.course_id
      AND courses.lecturer_id = auth.uid()
    )
  );

-- Enrolled users can view channels
CREATE POLICY "Enrolled users can view channels"
  ON public.channels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE enrollments.course_id = channels.course_id
      AND enrollments.user_id = auth.uid()
    )
  );
