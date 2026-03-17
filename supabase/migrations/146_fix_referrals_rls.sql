-- Migration 146: Fix referrals RLS — block direct inserts (SEC-01)
--
-- Problem: Users could insert arbitrary referral rows via RLS policy.
-- Fix: Block all direct inserts; referrals must go through SECURITY DEFINER
--       functions (process_referral, create_referral_from_enrollment) which
--       bypass RLS.

-- Drop the original policy (already gone via mig 117, but safe to repeat)
DROP POLICY IF EXISTS "System can insert referrals" ON public.referrals;

-- Drop the replacement policy from mig 117
DROP POLICY IF EXISTS "Users can insert own referrals" ON public.referrals;

-- Block ALL direct inserts — only SECURITY DEFINER RPCs can write referrals
CREATE POLICY "No direct referral inserts"
  ON public.referrals FOR INSERT
  WITH CHECK (false);

-- Safe RPC for creating referrals with validation
CREATE OR REPLACE FUNCTION public.create_referral_safe(
  p_referral_code TEXT,
  p_referred_user_id UUID,
  p_enrollment_request_id UUID,
  p_course_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id UUID;
  v_referral_id UUID;
BEGIN
  -- Validate referral code
  IF p_referral_code IS NULL OR TRIM(p_referral_code) = '' THEN
    RETURN NULL;
  END IF;

  -- Find referrer (cannot self-refer)
  SELECT id INTO v_referrer_id
  FROM profiles
  WHERE referral_code = UPPER(TRIM(p_referral_code))
    AND id != p_referred_user_id;

  IF v_referrer_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Verify enrollment request exists and belongs to the referred user
  IF NOT EXISTS (
    SELECT 1 FROM enrollment_requests
    WHERE id = p_enrollment_request_id
      AND user_id = p_referred_user_id
  ) THEN
    RAISE EXCEPTION 'Invalid enrollment request';
  END IF;

  -- Insert referral
  INSERT INTO referrals (
    referrer_id, referred_user_id, referral_code,
    enrollment_request_id, course_id
  ) VALUES (
    v_referrer_id, p_referred_user_id, UPPER(TRIM(p_referral_code)),
    p_enrollment_request_id, p_course_id
  )
  ON CONFLICT (referred_user_id, enrollment_request_id) DO NOTHING
  RETURNING id INTO v_referral_id;

  RETURN v_referral_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_referral_safe TO authenticated;
