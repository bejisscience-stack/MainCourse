-- Migration: Create videos table
-- Description: Stores videos for lecture channels with ordering and progress tracking

CREATE TABLE IF NOT EXISTS public.videos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration INTEGER, -- Duration in seconds
  display_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS videos_channel_id_idx ON public.videos(channel_id);
CREATE INDEX IF NOT EXISTS videos_course_id_idx ON public.videos(course_id);
CREATE INDEX IF NOT EXISTS videos_display_order_idx ON public.videos(channel_id, display_order);

-- Policies
DROP POLICY IF EXISTS "Lecturers can manage videos for their courses" ON public.videos;
DROP POLICY IF EXISTS "Enrolled users can view videos" ON public.videos;

-- Lecturers can manage videos
CREATE POLICY "Lecturers can manage videos for their courses"
  ON public.videos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = videos.course_id
      AND courses.lecturer_id = auth.uid()
    )
  );

-- Enrolled users can view published videos
CREATE POLICY "Enrolled users can view videos"
  ON public.videos FOR SELECT
  USING (
    is_published = true AND
    EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE enrollments.course_id = videos.course_id
      AND enrollments.user_id = auth.uid()
    )
  );







