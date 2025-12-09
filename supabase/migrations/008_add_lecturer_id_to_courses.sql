-- Migration: Add lecturer_id to courses table
-- Description: Links courses to lecturers who created them

-- Add lecturer_id column to courses table
ALTER TABLE public.courses 
ADD COLUMN IF NOT EXISTS lecturer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Create index on lecturer_id for faster lookups
CREATE INDEX IF NOT EXISTS courses_lecturer_id_idx ON public.courses(lecturer_id);

-- Drop existing policies if they exist (both old and new)
DROP POLICY IF EXISTS "Authenticated users can insert courses" ON public.courses;
DROP POLICY IF EXISTS "Authenticated users can update courses" ON public.courses;
DROP POLICY IF EXISTS "Lecturers can insert their own courses" ON public.courses;
DROP POLICY IF EXISTS "Lecturers can update their own courses" ON public.courses;
DROP POLICY IF EXISTS "Lecturers can delete their own courses" ON public.courses;

-- Policy: Lecturers can insert their own courses
CREATE POLICY "Lecturers can insert their own courses"
  ON public.courses FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'lecturer'
    ) AND
    lecturer_id = auth.uid()
  );

-- Policy: Lecturers can update their own courses
CREATE POLICY "Lecturers can update their own courses"
  ON public.courses FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'lecturer'
    ) AND
    lecturer_id = auth.uid()
  );

-- Policy: Lecturers can delete their own courses
CREATE POLICY "Lecturers can delete their own courses"
  ON public.courses FOR DELETE
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'lecturer'
    ) AND
    lecturer_id = auth.uid()
  );

