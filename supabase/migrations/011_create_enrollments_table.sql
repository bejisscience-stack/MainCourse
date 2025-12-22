-- Migration: Create enrollments table
-- Description: Tracks which users are enrolled in which courses

CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- Avoid duplicate enrollments
CREATE UNIQUE INDEX IF NOT EXISTS enrollments_user_course_idx ON public.enrollments(user_id, course_id);
CREATE INDEX IF NOT EXISTS enrollments_user_idx ON public.enrollments(user_id);
CREATE INDEX IF NOT EXISTS enrollments_course_idx ON public.enrollments(course_id);

-- Policies
DROP POLICY IF EXISTS "Users can view own enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Users can insert own enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Users can delete own enrollments" ON public.enrollments;

CREATE POLICY "Users can view own enrollments"
  ON public.enrollments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own enrollments"
  ON public.enrollments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own enrollments"
  ON public.enrollments FOR DELETE
  USING (auth.uid() = user_id);













