-- Migration 123: Restrict courses INSERT/UPDATE RLS (RLS-01)
-- Allow admins to insert/update courses alongside lecturers

-- Drop existing INSERT/UPDATE policies
DROP POLICY IF EXISTS "Lecturers can insert their own courses" ON public.courses;
DROP POLICY IF EXISTS "Lecturers can update their own courses" ON public.courses;

-- New INSERT: lecturers/admins can insert, lecturer_id must = auth.uid()
CREATE POLICY "Lecturers and admins can insert courses"
ON public.courses FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('lecturer', 'admin')
  )
  AND lecturer_id = auth.uid()
);

-- New UPDATE: lecturers own courses only, admins any course
CREATE POLICY "Lecturers and admins can update courses"
ON public.courses FOR UPDATE
USING (
  auth.role() = 'authenticated'
  AND (
    (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'lecturer')
     AND lecturer_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  )
);
