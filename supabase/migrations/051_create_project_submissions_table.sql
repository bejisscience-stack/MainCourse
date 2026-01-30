-- Migration: Create project_submissions table
-- Description: Creates a table for user video submissions to projects
-- This stores structured submission data instead of JSON in message content

CREATE TABLE IF NOT EXISTS public.project_submissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL UNIQUE,
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Submission details
  video_url TEXT,
  message TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.project_submissions ENABLE ROW LEVEL SECURITY;

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS project_submissions_project_id_idx ON public.project_submissions(project_id);
CREATE INDEX IF NOT EXISTS project_submissions_message_id_idx ON public.project_submissions(message_id);
CREATE INDEX IF NOT EXISTS project_submissions_channel_id_idx ON public.project_submissions(channel_id);
CREATE INDEX IF NOT EXISTS project_submissions_course_id_idx ON public.project_submissions(course_id);
CREATE INDEX IF NOT EXISTS project_submissions_user_id_idx ON public.project_submissions(user_id);
CREATE INDEX IF NOT EXISTS project_submissions_created_at_idx ON public.project_submissions(created_at DESC);

-- RLS Policies

-- Anyone enrolled in the course or the lecturer can view submissions
CREATE POLICY "Users can view submissions in enrolled courses"
  ON public.project_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.course_id = project_submissions.course_id
      AND e.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = project_submissions.course_id
      AND c.lecturer_id = auth.uid()
    )
  );

-- Enrolled students can create submissions (not lecturers or project creators)
CREATE POLICY "Enrolled students can create submissions"
  ON public.project_submissions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.course_id = project_submissions.course_id
      AND e.user_id = auth.uid()
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_submissions.project_id
      AND p.user_id = auth.uid()
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = project_submissions.course_id
      AND c.lecturer_id = auth.uid()
    )
  );

-- Only the submission creator can update their submission
CREATE POLICY "Submission creators can update submissions"
  ON public.project_submissions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Only the submission creator can delete their submission
CREATE POLICY "Submission creators can delete submissions"
  ON public.project_submissions FOR DELETE
  USING (user_id = auth.uid());

-- Trigger to update updated_at timestamp
CREATE TRIGGER on_project_submission_updated
  BEFORE UPDATE ON public.project_submissions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

