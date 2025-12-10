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

-- ============================================
-- Migration 009: Run Lecturer Updates
-- ============================================
-- Update the handle_new_user function to include role
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

-- Update existing profiles to have 'student' role if they don't have one
UPDATE public.profiles 
SET role = 'student' 
WHERE role IS NULL;

-- ============================================
-- Migration 010: Create Storage Buckets
-- ============================================
-- CRITICAL: This migration creates the storage buckets needed for video uploads
-- Create course-videos bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-videos',
  'course-videos',
  true,
  52428800, -- 50MB
  ARRAY['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska']
)
ON CONFLICT (id) DO UPDATE SET
  allowed_mime_types = ARRAY['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];

-- Create course-thumbnails bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-thumbnails',
  'course-thumbnails',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Lecturers can upload videos" ON storage.objects;
DROP POLICY IF EXISTS "Lecturers can update own videos" ON storage.objects;
DROP POLICY IF EXISTS "Lecturers can delete own videos" ON storage.objects;
DROP POLICY IF EXISTS "Lecturers can upload thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Lecturers can update own thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Lecturers can delete own thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Public can view videos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view thumbnails" ON storage.objects;

-- Policy: Lecturers can upload videos to their own folder
CREATE POLICY "Lecturers can upload videos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'course-videos' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'lecturer'
  ) AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Lecturers can update their own videos
CREATE POLICY "Lecturers can update own videos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'course-videos' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'lecturer'
  ) AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Lecturers can delete their own videos
CREATE POLICY "Lecturers can delete own videos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'course-videos' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'lecturer'
  ) AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Lecturers can upload thumbnails to their own folder
CREATE POLICY "Lecturers can upload thumbnails"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'course-thumbnails' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'lecturer'
  ) AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Lecturers can update their own thumbnails
CREATE POLICY "Lecturers can update own thumbnails"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'course-thumbnails' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'lecturer'
  ) AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Lecturers can delete their own thumbnails
CREATE POLICY "Lecturers can delete own thumbnails"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'course-thumbnails' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'lecturer'
  ) AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Public can view videos
CREATE POLICY "Public can view videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'course-videos');

-- Policy: Public can view thumbnails
CREATE POLICY "Public can view thumbnails"
ON storage.objects FOR SELECT
USING (bucket_id = 'course-thumbnails');

-- ============================================
-- Migration 011: Create Enrollments Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- Avoid duplicate enrollments
CREATE UNIQUE INDEX IF NOT EXISTS enrollments_user_course_idx ON public.enrollments(user_id, course_id);
CREATE INDEX IF NOT EXISTS enrollments_user_idx ON public.enrollments(user_id);
CREATE INDEX IF NOT EXISTS enrollments_course_idx ON public.enrollments(course_id);

-- Policies
DROP POLICY IF EXISTS "Users can view own enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Users can insert own enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Users can delete own enrollments" ON public.enrollments;

CREATE POLICY "Users can view own enrollments"
  ON public.enrollments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own enrollments"
  ON public.enrollments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own enrollments"
  ON public.enrollments FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Migration 012: Add Created At Index
-- ============================================
CREATE INDEX IF NOT EXISTS courses_created_at_idx ON public.courses(created_at DESC);

-- ============================================
-- Migration 013: Create Channels Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.channels (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'voice', 'lectures')),
  description TEXT,
  category_name TEXT DEFAULT 'COURSE CHANNELS',
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE(course_id, name)
);

-- Enable Row Level Security
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS channels_course_id_idx ON public.channels(course_id);
CREATE INDEX IF NOT EXISTS channels_type_idx ON public.channels(type);
CREATE INDEX IF NOT EXISTS channels_display_order_idx ON public.channels(course_id, display_order);

-- Policies
DROP POLICY IF EXISTS "Lecturers can view channels for their courses" ON public.channels;
DROP POLICY IF EXISTS "Lecturers can create channels for their courses" ON public.channels;
DROP POLICY IF EXISTS "Lecturers can update channels for their courses" ON public.channels;
DROP POLICY IF EXISTS "Lecturers can delete channels for their courses" ON public.channels;
DROP POLICY IF EXISTS "Enrolled users can view channels" ON public.channels;

-- Lecturers can manage channels for their courses
CREATE POLICY "Lecturers can view channels for their courses"
  ON public.channels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = channels.course_id
      AND courses.lecturer_id = auth.uid()
    )
  );

CREATE POLICY "Lecturers can create channels for their courses"
  ON public.channels FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = channels.course_id
      AND courses.lecturer_id = auth.uid()
    )
  );

CREATE POLICY "Lecturers can update channels for their courses"
  ON public.channels FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = channels.course_id
      AND courses.lecturer_id = auth.uid()
    )
  );

CREATE POLICY "Lecturers can delete channels for their courses"
  ON public.channels FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = channels.course_id
      AND courses.lecturer_id = auth.uid()
    )
  );

-- Enrolled users can view channels
CREATE POLICY "Enrolled users can view channels"
  ON public.channels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE enrollments.course_id = channels.course_id
      AND enrollments.user_id = auth.uid()
    )
  );

-- ============================================
-- Migration 014: Create Videos Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.videos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration INTEGER, -- Duration in seconds
  display_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS videos_channel_id_idx ON public.videos(channel_id);
CREATE INDEX IF NOT EXISTS videos_course_id_idx ON public.videos(course_id);
CREATE INDEX IF NOT EXISTS videos_display_order_idx ON public.videos(channel_id, display_order);

-- Policies
DROP POLICY IF EXISTS "Lecturers can manage videos for their courses" ON public.videos;
DROP POLICY IF EXISTS "Enrolled users can view videos" ON public.videos;

-- Lecturers can manage videos
CREATE POLICY "Lecturers can manage videos for their courses"
  ON public.videos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = videos.course_id
      AND courses.lecturer_id = auth.uid()
    )
  );

-- Enrolled users can view published videos
CREATE POLICY "Enrolled users can view videos"
  ON public.videos FOR SELECT
  USING (
    is_published = true AND
    EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE enrollments.course_id = videos.course_id
      AND enrollments.user_id = auth.uid()
    )
  );

-- ============================================
-- Migration 015: Create Video Progress Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.video_progress (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  progress_seconds INTEGER DEFAULT 0, -- Current position in video
  duration_seconds INTEGER, -- Total video duration
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE(user_id, video_id)
);

-- Enable Row Level Security
ALTER TABLE public.video_progress ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS video_progress_user_id_idx ON public.video_progress(user_id);
CREATE INDEX IF NOT EXISTS video_progress_video_id_idx ON public.video_progress(video_id);
CREATE INDEX IF NOT EXISTS video_progress_course_id_idx ON public.video_progress(course_id);
CREATE INDEX IF NOT EXISTS video_progress_completed_idx ON public.video_progress(user_id, course_id, is_completed);

-- Policies
DROP POLICY IF EXISTS "Users can view their own progress" ON public.video_progress;
DROP POLICY IF EXISTS "Users can update their own progress" ON public.video_progress;
DROP POLICY IF EXISTS "Lecturers can view progress for their courses" ON public.video_progress;

CREATE POLICY "Users can view their own progress"
  ON public.video_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress"
  ON public.video_progress FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Lecturers can view progress for their courses"
  ON public.video_progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = video_progress.course_id
      AND courses.lecturer_id = auth.uid()
    )
  );

