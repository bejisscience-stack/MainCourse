-- Migration: Add criteria table for projects
-- Description: Creates a table to store project criteria with RPM (Rate Per Match) values

CREATE TABLE IF NOT EXISTS public.project_criteria (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  criteria_text TEXT NOT NULL,
  rpm DECIMAL(10, 2) NOT NULL CHECK (rpm >= 0), -- Rate Per Match (payment amount)
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.project_criteria ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS project_criteria_project_id_idx ON public.project_criteria(project_id);
CREATE INDEX IF NOT EXISTS project_criteria_display_order_idx ON public.project_criteria(project_id, display_order);

-- RLS Policies

-- Anyone enrolled in the course or the lecturer can view criteria
CREATE POLICY "Users can view criteria in enrolled courses"
  ON public.project_criteria FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_criteria.project_id
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

-- Only lecturers can create criteria for their projects
CREATE POLICY "Lecturers can create criteria"
  ON public.project_criteria FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.courses c ON c.id = p.course_id
      WHERE p.id = project_criteria.project_id
      AND c.lecturer_id = auth.uid()
    )
  );

-- Only lecturers can update criteria for their projects
CREATE POLICY "Lecturers can update criteria"
  ON public.project_criteria FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.courses c ON c.id = p.course_id
      WHERE p.id = project_criteria.project_id
      AND c.lecturer_id = auth.uid()
    )
  );

-- Only lecturers can delete criteria for their projects
CREATE POLICY "Lecturers can delete criteria"
  ON public.project_criteria FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.courses c ON c.id = p.course_id
      WHERE p.id = project_criteria.project_id
      AND c.lecturer_id = auth.uid()
    )
  );


