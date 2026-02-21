-- ============================================
-- Complete SQL for Lecturer Feature Updates
-- Run this file in Supabase SQL Editor
-- ============================================

-- Step 1: Update the handle_new_user function to include role
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Add role column to profiles table
-- ============================================
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'student' CHECK (role IN ('student', 'lecturer'));

-- Create index on role for faster lookups
CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles(role);

-- Update existing profiles to have 'student' role if they don't have one
UPDATE public.profiles 
SET role = 'student' 
WHERE role IS NULL;

-- Step 3: Add lecturer_id to courses table
-- ============================================
ALTER TABLE public.courses 
ADD COLUMN IF NOT EXISTS lecturer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Create index on lecturer_id for faster lookups
CREATE INDEX IF NOT EXISTS courses_lecturer_id_idx ON public.courses(lecturer_id);

-- Step 4: Update RLS policies for courses
-- ============================================
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

-- ============================================
-- Migration Complete!
-- ============================================
-- You can now:
-- 1. Register new users as lecturers
-- 2. Lecturers can access /lecturer/dashboard
-- 3. Lecturers can create, edit, and delete their own courses

