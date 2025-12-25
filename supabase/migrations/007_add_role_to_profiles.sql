-- Migration: Add role field to profiles table
-- Description: Adds a role field to distinguish between students and lecturers

-- Add role column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'student' CHECK (role IN ('student', 'lecturer'));

-- Create index on role for faster lookups
CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles(role);














