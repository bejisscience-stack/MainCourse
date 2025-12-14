-- Migration: Create enrollment requests system and add admin role
-- Description: Adds admin role, creates enrollment_requests table, and updates enrollments RLS

-- Step 1: Add 'admin' role to profiles table
-- ============================================
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('student', 'lecturer', 'admin'));

-- Update existing NULL roles to 'student' if any exist
UPDATE public.profiles 
SET role = 'student' 
WHERE role IS NULL;

-- Step 2: Create enrollment_requests table
-- ============================================
CREATE TABLE IF NOT EXISTS public.enrollment_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  -- Prevent duplicate pending requests
  UNIQUE(user_id, course_id, status) DEFERRABLE INITIALLY DEFERRED
);

-- Enable Row Level Security
ALTER TABLE public.enrollment_requests ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS enrollment_requests_user_id_idx ON public.enrollment_requests(user_id);
CREATE INDEX IF NOT EXISTS enrollment_requests_course_id_idx ON public.enrollment_requests(course_id);
CREATE INDEX IF NOT EXISTS enrollment_requests_status_idx ON public.enrollment_requests(status);
CREATE INDEX IF NOT EXISTS enrollment_requests_created_at_idx ON public.enrollment_requests(created_at DESC);

-- Unique index to prevent duplicate pending requests (enforced at DB level)
CREATE UNIQUE INDEX IF NOT EXISTS enrollment_requests_user_course_pending_idx 
ON public.enrollment_requests(user_id, course_id) 
WHERE status = 'pending';

-- RLS Policies for enrollment_requests
-- Users can view their own requests
DROP POLICY IF EXISTS "Users can view own enrollment requests" ON public.enrollment_requests;
CREATE POLICY "Users can view own enrollment requests"
  ON public.enrollment_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own enrollment requests
DROP POLICY IF EXISTS "Users can insert own enrollment requests" ON public.enrollment_requests;
CREATE POLICY "Users can insert own enrollment requests"
  ON public.enrollment_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all enrollment requests
DROP POLICY IF EXISTS "Admins can view all enrollment requests" ON public.enrollment_requests;
CREATE POLICY "Admins can view all enrollment requests"
  ON public.enrollment_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can update enrollment requests (approve/reject)
DROP POLICY IF EXISTS "Admins can update enrollment requests" ON public.enrollment_requests;
CREATE POLICY "Admins can update enrollment requests"
  ON public.enrollment_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Step 3: Update enrollments table RLS to prevent direct user inserts
-- ============================================
-- Drop the policy that allows users to insert their own enrollments
DROP POLICY IF EXISTS "Users can insert own enrollments" ON public.enrollments;

-- Only admins (or system through functions) can insert enrollments directly
-- Users can only view their own enrollments
DROP POLICY IF EXISTS "Admins can insert enrollments" ON public.enrollments;
CREATE POLICY "Admins can insert enrollments"
  ON public.enrollments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Keep existing policies for SELECT and DELETE
-- (Users can view and delete their own enrollments)

-- Step 4: Create function to handle enrollment approval
-- ============================================
CREATE OR REPLACE FUNCTION public.approve_enrollment_request(request_id UUID)
RETURNS void AS $$
DECLARE
  request_record public.enrollment_requests%ROWTYPE;
  admin_user_id UUID;
BEGIN
  -- Get admin user ID
  SELECT id INTO admin_user_id
  FROM public.profiles
  WHERE id = auth.uid() AND role = 'admin';
  
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can approve enrollment requests';
  END IF;
  
  -- Get the enrollment request
  SELECT * INTO request_record
  FROM public.enrollment_requests
  WHERE id = request_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment request not found or already processed';
  END IF;
  
  -- Update request status
  UPDATE public.enrollment_requests
  SET 
    status = 'approved',
    reviewed_by = admin_user_id,
    reviewed_at = TIMEZONE('utc', NOW()),
    updated_at = TIMEZONE('utc', NOW())
  WHERE id = request_id;
  
  -- Insert into enrollments (or update if exists)
  INSERT INTO public.enrollments (user_id, course_id)
  VALUES (request_record.user_id, request_record.course_id)
  ON CONFLICT (user_id, course_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Create function to handle enrollment rejection
-- ============================================
CREATE OR REPLACE FUNCTION public.reject_enrollment_request(request_id UUID)
RETURNS void AS $$
DECLARE
  admin_user_id UUID;
BEGIN
  -- Get admin user ID
  SELECT id INTO admin_user_id
  FROM public.profiles
  WHERE id = auth.uid() AND role = 'admin';
  
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can reject enrollment requests';
  END IF;
  
  -- Update request status
  UPDATE public.enrollment_requests
  SET 
    status = 'rejected',
    reviewed_by = admin_user_id,
    reviewed_at = TIMEZONE('utc', NOW()),
    updated_at = TIMEZONE('utc', NOW())
  WHERE id = request_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment request not found or already processed';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Add trigger to update updated_at on enrollment_requests
-- ============================================
DROP TRIGGER IF EXISTS on_enrollment_request_updated ON public.enrollment_requests;
CREATE TRIGGER on_enrollment_request_updated
  BEFORE UPDATE ON public.enrollment_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Step 7: Add approved_at column to enrollments table (optional, for tracking when approved)
-- ============================================
ALTER TABLE public.enrollments 
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

