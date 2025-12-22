-- Migration: Add referral system
-- Description: Adds referral codes to profiles, tracks referrals, and links them to enrollment requests

-- Step 1: Add referral_code column to profiles table
-- ============================================
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- Create index on referral_code for faster lookups
CREATE INDEX IF NOT EXISTS profiles_referral_code_idx ON public.profiles(referral_code) 
WHERE referral_code IS NOT NULL;

-- Step 2: Create referrals table to track who referred whom
-- ============================================
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  referrer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  referral_code TEXT NOT NULL,
  enrollment_request_id UUID REFERENCES public.enrollment_requests(id) ON DELETE SET NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  -- Prevent duplicate referrals for the same user
  UNIQUE(referred_user_id, enrollment_request_id)
);

-- Enable Row Level Security
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS referrals_referrer_id_idx ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS referrals_referred_user_id_idx ON public.referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS referrals_referral_code_idx ON public.referrals(referral_code);
CREATE INDEX IF NOT EXISTS referrals_enrollment_request_id_idx ON public.referrals(enrollment_request_id);
CREATE INDEX IF NOT EXISTS referrals_course_id_idx ON public.referrals(course_id);
CREATE INDEX IF NOT EXISTS referrals_created_at_idx ON public.referrals(created_at DESC);

-- RLS Policies for referrals
-- Users can view referrals where they are the referrer or referred user
DROP POLICY IF EXISTS "Users can view own referrals" ON public.referrals;
CREATE POLICY "Users can view own referrals"
  ON public.referrals FOR SELECT
  USING (
    auth.uid() = referrer_id OR 
    auth.uid() = referred_user_id
  );

-- Admins can view all referrals
DROP POLICY IF EXISTS "Admins can view all referrals" ON public.referrals;
CREATE POLICY "Admins can view all referrals"
  ON public.referrals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- System can insert referrals (through API)
DROP POLICY IF EXISTS "System can insert referrals" ON public.referrals;
CREATE POLICY "System can insert referrals"
  ON public.referrals FOR INSERT
  WITH CHECK (true);

-- Step 3: Add referral_code column to enrollment_requests table
-- ============================================
ALTER TABLE public.enrollment_requests 
ADD COLUMN IF NOT EXISTS referral_code TEXT;

-- Create index on referral_code in enrollment_requests
CREATE INDEX IF NOT EXISTS enrollment_requests_referral_code_idx ON public.enrollment_requests(referral_code) 
WHERE referral_code IS NOT NULL;

-- Step 4: Create function to generate unique referral code
-- ============================================
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    -- Generate a random 8-character alphanumeric code (uppercase)
    code := UPPER(
      SUBSTRING(
        MD5(RANDOM()::TEXT || NOW()::TEXT || RANDOM()::TEXT),
        1,
        8
      )
    );
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = code) INTO exists_check;
    
    -- Exit loop if code is unique
    EXIT WHEN NOT exists_check;
  END LOOP;
  
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create function to automatically generate referral code for new users
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate if referral_code is NULL
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := public.generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate referral codes
DROP TRIGGER IF EXISTS auto_generate_referral_code_trigger ON public.profiles;
CREATE TRIGGER auto_generate_referral_code_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (NEW.referral_code IS NULL)
  EXECUTE FUNCTION public.auto_generate_referral_code();

-- Step 6: Create function to process referral when enrollment request is created
-- ============================================
CREATE OR REPLACE FUNCTION public.process_referral(
  p_referral_code TEXT,
  p_referred_user_id UUID,
  p_enrollment_request_id UUID,
  p_course_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_referrer_id UUID;
  v_referral_id UUID;
BEGIN
  -- If no referral code provided, return NULL
  IF p_referral_code IS NULL OR TRIM(p_referral_code) = '' THEN
    RETURN NULL;
  END IF;
  
  -- Find the referrer by referral code
  SELECT id INTO v_referrer_id
  FROM public.profiles
  WHERE referral_code = UPPER(TRIM(p_referral_code))
  AND id != p_referred_user_id; -- Can't refer yourself
  
  -- If referrer not found, return NULL (invalid referral code)
  IF v_referrer_id IS NULL THEN
    RETURN NULL;
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
    p_referred_user_id,
    UPPER(TRIM(p_referral_code)),
    p_enrollment_request_id,
    p_course_id
  )
  ON CONFLICT (referred_user_id, enrollment_request_id) DO NOTHING
  RETURNING id INTO v_referral_id;
  
  RETURN v_referral_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Backfill referral codes for existing users
-- ============================================
-- Generate referral codes for all existing users who don't have one
UPDATE public.profiles
SET referral_code = public.generate_referral_code()
WHERE referral_code IS NULL;

