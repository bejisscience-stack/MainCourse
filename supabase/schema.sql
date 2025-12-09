-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
-- This table stores additional user profile information
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Function to automatically create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function when a new user is created
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on profile updates
CREATE OR REPLACE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Optional: Create an index on email for faster lookups
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);

-- Courses table
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

-- Enable Row Level Security for courses
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view courses (public read access)
CREATE POLICY "Courses are viewable by everyone"
  ON public.courses FOR SELECT
  USING (true);

-- Policy: Only authenticated users can insert courses (for admin/creators)
CREATE POLICY "Authenticated users can insert courses"
  ON public.courses FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Only authenticated users can update courses
CREATE POLICY "Authenticated users can update courses"
  ON public.courses FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Trigger to update updated_at on course updates
CREATE OR REPLACE TRIGGER on_course_updated
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS courses_type_idx ON public.courses(course_type);
CREATE INDEX IF NOT EXISTS courses_rating_idx ON public.courses(rating DESC);
CREATE INDEX IF NOT EXISTS courses_bestseller_idx ON public.courses(is_bestseller) WHERE is_bestseller = true;

