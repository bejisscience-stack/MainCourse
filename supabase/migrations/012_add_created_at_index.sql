-- Migration: Add index on created_at for courses table
-- Description: Improves query performance when ordering courses by created_at

-- Create index on created_at for faster ordering queries
CREATE INDEX IF NOT EXISTS courses_created_at_idx ON public.courses(created_at DESC);



