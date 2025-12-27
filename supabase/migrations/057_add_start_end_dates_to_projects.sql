-- Migration: Add start_date and end_date to projects table
-- Description: Adds start and end date fields to projects so lecturers can specify project duration

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE;

-- Add constraint to ensure end_date is after start_date
ALTER TABLE public.projects
DROP CONSTRAINT IF EXISTS projects_end_date_after_start_date;

ALTER TABLE public.projects
ADD CONSTRAINT projects_end_date_after_start_date 
CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date);

-- Add index for querying projects by date range
CREATE INDEX IF NOT EXISTS projects_start_date_idx ON public.projects(start_date);
CREATE INDEX IF NOT EXISTS projects_end_date_idx ON public.projects(end_date);







