-- Migration: Add course-specific referral tracking
-- Description: Tracks which course a user was referred for and first login status

-- Step 1: Add referred_for_course_id column to profiles table
-- ============================================
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS referred_for_course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL;

-- Create index on referred_for_course_id for faster lookups
CREATE INDEX IF NOT EXISTS profiles_referred_for_course_id_idx ON public.profiles(referred_for_course_id) 
WHERE referred_for_course_id IS NOT NULL;

-- Step 2: Add first_login_completed column to profiles table
-- ============================================
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS first_login_completed BOOLEAN DEFAULT false;

-- Create index on first_login_completed for faster lookups
CREATE INDEX IF NOT EXISTS profiles_first_login_completed_idx ON public.profiles(first_login_completed) 
WHERE first_login_completed = false;

-- Step 3: Update handle_new_user function to store course ID from metadata
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_username TEXT;
  signup_ref_code TEXT;
  signup_course_id TEXT;
BEGIN
  -- Get username from metadata (required)
  user_username := NEW.raw_user_meta_data->>'username';
  
  -- Get referral code from metadata (optional)
  signup_ref_code := NEW.raw_user_meta_data->>'signup_referral_code';
  
  -- Get course ID from metadata (optional)
  signup_course_id := NEW.raw_user_meta_data->>'signup_course_id';
  
  -- Validate username is provided
  IF user_username IS NULL OR TRIM(user_username) = '' THEN
    RAISE EXCEPTION 'Username is required for registration';
  END IF;
  
  -- Trim and validate username format
  user_username := TRIM(user_username);
  
  IF LENGTH(user_username) < 3 OR LENGTH(user_username) > 30 THEN
    RAISE EXCEPTION 'Username must be between 3 and 30 characters';
  END IF;
  
  IF NOT (user_username ~ '^[a-zA-Z0-9_]+$') THEN
    RAISE EXCEPTION 'Username can only contain letters, numbers, and underscores';
  END IF;
  
  -- Check uniqueness
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = user_username) THEN
    RAISE EXCEPTION 'Username already exists. Please choose a different username.';
  END IF;
  
  -- Insert profile with referral code and course ID if provided
  INSERT INTO public.profiles (
    id, 
    email, 
    username, 
    role, 
    signup_referral_code,
    referred_for_course_id,
    first_login_completed
  )
  VALUES (
    NEW.id,
    NEW.email,
    user_username,
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    CASE 
      WHEN signup_ref_code IS NOT NULL AND TRIM(signup_ref_code) != '' 
      THEN UPPER(TRIM(signup_ref_code))
      ELSE NULL
    END,
    CASE 
      WHEN signup_course_id IS NOT NULL AND TRIM(signup_course_id) != '' 
      THEN signup_course_id::UUID
      ELSE NULL
    END,
    false -- First login not completed yet
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

