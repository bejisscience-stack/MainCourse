-- Migration: Create muted_users table
-- Description: Tracks which users are muted in which channels (lecturer-only feature)

CREATE TABLE IF NOT EXISTS public.muted_users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  muted_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE(channel_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.muted_users ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS muted_users_channel_id_idx ON public.muted_users(channel_id);
CREATE INDEX IF NOT EXISTS muted_users_course_id_idx ON public.muted_users(course_id);
CREATE INDEX IF NOT EXISTS muted_users_user_id_idx ON public.muted_users(user_id);

-- Policies
DROP POLICY IF EXISTS "Lecturers can view muted users in their courses" ON public.muted_users;
DROP POLICY IF EXISTS "Enrolled users can view muted users in their courses" ON public.muted_users;
DROP POLICY IF EXISTS "Lecturers can mute users in their courses" ON public.muted_users;
DROP POLICY IF EXISTS "Lecturers can unmute users in their courses" ON public.muted_users;

-- Lecturers can view muted users in their courses
CREATE POLICY "Lecturers can view muted users in their courses"
  ON public.muted_users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = muted_users.course_id
      AND courses.lecturer_id = auth.uid()
    )
  );

-- Enrolled users can view muted users (to know if they're muted)
CREATE POLICY "Enrolled users can view muted users in their courses"
  ON public.muted_users FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE enrollments.course_id = muted_users.course_id
      AND enrollments.user_id = auth.uid()
    )
  );

-- Lecturers can mute users in their courses
CREATE POLICY "Lecturers can mute users in their courses"
  ON public.muted_users FOR INSERT
  WITH CHECK (
    auth.uid() = muted_by AND
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = muted_users.course_id
      AND courses.lecturer_id = auth.uid()
    )
  );

-- Lecturers can unmute users in their courses
CREATE POLICY "Lecturers can unmute users in their courses"
  ON public.muted_users FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = muted_users.course_id
      AND courses.lecturer_id = auth.uid()
    )
  );












