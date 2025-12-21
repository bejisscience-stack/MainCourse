-- Migration: Create projects table
-- Description: Creates a dedicated table for project submissions in the projects channel
-- This stores structured project data instead of JSON in message content

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL UNIQUE,
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Project details
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  video_link TEXT,
  budget DECIMAL(10, 2) NOT NULL CHECK (budget >= 0),
  min_views INTEGER NOT NULL CHECK (min_views >= 5000),
  max_views INTEGER NOT NULL CHECK (max_views > min_views),
  platforms TEXT[] NOT NULL CHECK (array_length(platforms, 1) > 0),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS projects_message_id_idx ON public.projects(message_id);
CREATE INDEX IF NOT EXISTS projects_channel_id_idx ON public.projects(channel_id);
CREATE INDEX IF NOT EXISTS projects_course_id_idx ON public.projects(course_id);
CREATE INDEX IF NOT EXISTS projects_user_id_idx ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS projects_created_at_idx ON public.projects(created_at DESC);

-- RLS Policies

-- Anyone enrolled in the course or the lecturer can view projects
CREATE POLICY "Users can view projects in enrolled courses"
  ON public.projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.course_id = projects.course_id
      AND e.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = projects.course_id
      AND c.lecturer_id = auth.uid()
    )
  );

-- Only lecturers can create projects
CREATE POLICY "Lecturers can create projects"
  ON public.projects FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = projects.course_id
      AND c.lecturer_id = auth.uid()
    )
  );

-- Only the project creator (lecturer) can update projects
CREATE POLICY "Project creators can update projects"
  ON public.projects FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Only the project creator (lecturer) can delete projects
CREATE POLICY "Project creators can delete projects"
  ON public.projects FOR DELETE
  USING (user_id = auth.uid());

-- Trigger to update updated_at timestamp
CREATE TRIGGER on_project_updated
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

