-- Migration: Create video_progress table
-- Description: Tracks user progress through videos for progressive unlocking

CREATE TABLE IF NOT EXISTS public.video_progress (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  progress_seconds INTEGER DEFAULT 0, -- Current position in video
  duration_seconds INTEGER, -- Total video duration
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE(user_id, video_id)
);

-- Enable Row Level Security
ALTER TABLE public.video_progress ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS video_progress_user_id_idx ON public.video_progress(user_id);
CREATE INDEX IF NOT EXISTS video_progress_video_id_idx ON public.video_progress(video_id);
CREATE INDEX IF NOT EXISTS video_progress_course_id_idx ON public.video_progress(course_id);
CREATE INDEX IF NOT EXISTS video_progress_completed_idx ON public.video_progress(user_id, course_id, is_completed);

-- Policies
DROP POLICY IF EXISTS "Users can view their own progress" ON public.video_progress;
DROP POLICY IF EXISTS "Users can update their own progress" ON public.video_progress;
DROP POLICY IF EXISTS "Lecturers can view progress for their courses" ON public.video_progress;

CREATE POLICY "Users can view their own progress"
  ON public.video_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress"
  ON public.video_progress FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Lecturers can view progress for their courses"
  ON public.video_progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = video_progress.course_id
      AND courses.lecturer_id = auth.uid()
    )
  );












