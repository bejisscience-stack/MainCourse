-- Optional project resources: images, videos, and external links (Drive, Dropbox, etc.)

CREATE TABLE IF NOT EXISTS public.project_resources (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('image', 'video', 'link')),
  title TEXT,
  url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

ALTER TABLE public.project_resources ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS project_resources_project_id_idx
  ON public.project_resources(project_id);
CREATE INDEX IF NOT EXISTS project_resources_display_order_idx
  ON public.project_resources(project_id, display_order);

-- Public read for active projects (marketing / project detail pages)
CREATE POLICY "Anyone can view resources for active projects"
  ON public.project_resources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_resources.project_id
        AND p.start_date IS NOT NULL
        AND p.end_date IS NOT NULL
        AND CURRENT_DATE >= p.start_date
        AND CURRENT_DATE <= p.end_date
    )
  );

-- Enrolled students and course lecturers
CREATE POLICY "Users can view resources in enrolled courses"
  ON public.project_resources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_resources.project_id
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
          OR p.user_id = auth.uid()
        )
    )
  );

-- Project subscription access
CREATE POLICY "Project access users can view resources"
  ON public.project_resources FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND has_project_access(auth.uid())
  );

-- Project owner CRUD
CREATE POLICY "Project owners can insert resources"
  ON public.project_resources FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_resources.project_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Project owners can update resources"
  ON public.project_resources FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_resources.project_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Project owners can delete resources"
  ON public.project_resources FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_resources.project_id
        AND p.user_id = auth.uid()
    )
  );

-- Realtime (mirrors project_criteria)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'project_resources'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.project_resources;
  END IF;
END $$;
