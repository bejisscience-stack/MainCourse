-- Migration: Create submission_reviews table
-- Description: Stores lecturer reviews/approvals for project submissions with criteria matching

CREATE TABLE IF NOT EXISTS public.submission_reviews (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  submission_id UUID REFERENCES public.project_submissions(id) ON DELETE CASCADE NOT NULL UNIQUE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  lecturer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Review status
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
  
  -- Matched criteria (array of criteria IDs that the video matches)
  matched_criteria_ids UUID[] DEFAULT ARRAY[]::UUID[],
  
  -- Lecturer comment
  comment TEXT,
  
  -- Payment amount (calculated from matched criteria RPMs)
  payment_amount DECIMAL(10, 2) DEFAULT 0 CHECK (payment_amount >= 0),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.submission_reviews ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS submission_reviews_submission_id_idx ON public.submission_reviews(submission_id);
CREATE INDEX IF NOT EXISTS submission_reviews_project_id_idx ON public.submission_reviews(project_id);
CREATE INDEX IF NOT EXISTS submission_reviews_lecturer_id_idx ON public.submission_reviews(lecturer_id);
CREATE INDEX IF NOT EXISTS submission_reviews_status_idx ON public.submission_reviews(status);

-- RLS Policies

-- Anyone enrolled in the course or the lecturer can view reviews
CREATE POLICY "Users can view reviews in enrolled courses"
  ON public.submission_reviews FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_submissions ps
      JOIN public.projects p ON p.id = ps.project_id
      WHERE ps.id = submission_reviews.submission_id
      AND (
        EXISTS (
          SELECT 1 FROM public.enrollments e
          WHERE e.course_id = p.course_id
          AND e.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.courses c
          WHERE c.id = p.course_id
          AND c.lecturer_id = auth.uid()
        )
      )
    )
  );

-- Only lecturers can create/update reviews for their projects
CREATE POLICY "Lecturers can create reviews"
  ON public.submission_reviews FOR INSERT
  WITH CHECK (
    auth.uid() = lecturer_id AND
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.courses c ON c.id = p.course_id
      WHERE p.id = submission_reviews.project_id
      AND c.lecturer_id = auth.uid()
    )
  );

-- Only lecturers can update reviews for their projects
CREATE POLICY "Lecturers can update reviews"
  ON public.submission_reviews FOR UPDATE
  USING (
    auth.uid() = lecturer_id AND
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.courses c ON c.id = p.course_id
      WHERE p.id = submission_reviews.project_id
      AND c.lecturer_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = lecturer_id AND
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.courses c ON c.id = p.course_id
      WHERE p.id = submission_reviews.project_id
      AND c.lecturer_id = auth.uid()
    )
  );

-- Trigger to update updated_at timestamp
CREATE TRIGGER on_submission_review_updated
  BEFORE UPDATE ON public.submission_reviews
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();



