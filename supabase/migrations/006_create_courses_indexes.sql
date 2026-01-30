-- Migration: Create indexes for courses table
-- Description: Creates indexes to improve query performance for courses

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS courses_type_idx ON public.courses(course_type);
CREATE INDEX IF NOT EXISTS courses_rating_idx ON public.courses(rating DESC);
CREATE INDEX IF NOT EXISTS courses_bestseller_idx ON public.courses(is_bestseller) WHERE is_bestseller = true;
CREATE INDEX IF NOT EXISTS courses_created_at_idx ON public.courses(created_at DESC);

