-- Run All Migrations
-- This file combines all migrations in order for easy execution
-- You can copy and paste this entire file into Supabase SQL Editor

-- ============================================
-- Migration 001: Enable Extensions
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Migration 002: Create Profiles Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);

-- ============================================
-- Migration 003: Create Profile Functions
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

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- Migration 004: Create Updated At Function
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;

CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- Migration 005: Create Courses Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  course_type TEXT NOT NULL CHECK (course_type IN ('Editing', 'Content Creation', 'Website Creation')),
  price DECIMAL(10, 2) NOT NULL,
  original_price DECIMAL(10, 2),
  author TEXT NOT NULL,
  creator TEXT NOT NULL,
  intro_video_url TEXT,
  thumbnail_url TEXT,
  rating DECIMAL(3, 1) DEFAULT 0.0,
  review_count INTEGER DEFAULT 0,
  is_bestseller BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Courses are viewable by everyone" ON public.courses;
DROP POLICY IF EXISTS "Authenticated users can insert courses" ON public.courses;
DROP POLICY IF EXISTS "Authenticated users can update courses" ON public.courses;

CREATE POLICY "Courses are viewable by everyone"
  ON public.courses FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert courses"
  ON public.courses FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update courses"
  ON public.courses FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_course_updated ON public.courses;

CREATE TRIGGER on_course_updated
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- Migration 006: Create Courses Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS courses_type_idx ON public.courses(course_type);
CREATE INDEX IF NOT EXISTS courses_rating_idx ON public.courses(rating DESC);
CREATE INDEX IF NOT EXISTS courses_bestseller_idx ON public.courses(is_bestseller) WHERE is_bestseller = true;

-- ============================================
-- Migration 007: Add Role to Profiles
-- ============================================
-- Add role column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'student' CHECK (role IN ('student', 'lecturer'));

-- Create index on role for faster lookups
CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles(role);

-- ============================================
-- Migration 008: Add Lecturer ID to Courses
-- ============================================
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

