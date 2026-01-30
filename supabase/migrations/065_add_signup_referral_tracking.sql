-- Migration: Add signup referral tracking
-- Description: Tracks referral codes used during signup and creates referral records when users enroll

-- Step 1: Add signup_referral_code column to profiles table
-- ============================================
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS signup_referral_code TEXT;

-- Create index on signup_referral_code for faster lookups
CREATE INDEX IF NOT EXISTS profiles_signup_referral_code_idx ON public.profiles(signup_referral_code) 
WHERE signup_referral_code IS NOT NULL;

-- Step 2: Update handle_new_user function to store referral code from metadata
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_username TEXT;
  signup_ref_code TEXT;
BEGIN
  -- Get username from metadata (required)
  user_username := NEW.raw_user_meta_data->>'username';
  
  -- Get referral code from metadata (optional)
  signup_ref_code := NEW.raw_user_meta_data->>'signup_referral_code';
  
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
  
  -- Insert profile with referral code if provided
  INSERT INTO public.profiles (id, email, username, role, signup_referral_code)
  VALUES (
    NEW.id,
    NEW.email,
    user_username,
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    CASE 
      WHEN signup_ref_code IS NOT NULL AND TRIM(signup_ref_code) != '' 
      THEN UPPER(TRIM(signup_ref_code))
      ELSE NULL
    END
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create function to process signup referral when user enrolls
-- ============================================
CREATE OR REPLACE FUNCTION public.process_signup_referral_on_enrollment(
  p_user_id UUID,
  p_enrollment_request_id UUID,
  p_course_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_signup_ref_code TEXT;
  v_referrer_id UUID;
  v_referral_id UUID;
BEGIN
  -- Get the signup referral code from user's profile
  SELECT signup_referral_code INTO v_signup_ref_code
  FROM public.profiles
  WHERE id = p_user_id;
  
  -- If no signup referral code, return NULL
  IF v_signup_ref_code IS NULL OR TRIM(v_signup_ref_code) = '' THEN
    RETURN NULL;
  END IF;
  
  -- Find the referrer by referral code
  SELECT id INTO v_referrer_id
  FROM public.profiles
  WHERE referral_code = UPPER(TRIM(v_signup_ref_code))
  AND id != p_user_id; -- Can't refer yourself
  
  -- If referrer not found, return NULL (invalid referral code)
  IF v_referrer_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Check if referral already exists for this enrollment request
  SELECT id INTO v_referral_id
  FROM public.referrals
  WHERE referred_user_id = p_user_id
  AND enrollment_request_id = p_enrollment_request_id;
  
  -- If referral already exists, return it
  IF v_referral_id IS NOT NULL THEN
    RETURN v_referral_id;
  END IF;
  
  -- Create referral record
  INSERT INTO public.referrals (
    referrer_id,
    referred_user_id,
    referral_code,
    enrollment_request_id,
    course_id
  )
  VALUES (
    v_referrer_id,
    p_user_id,
    UPPER(TRIM(v_signup_ref_code)),
    p_enrollment_request_id,
    p_course_id
  )
  ON CONFLICT (referred_user_id, enrollment_request_id) DO NOTHING
  RETURNING id INTO v_referral_id;
  
  RETURN v_referral_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;





