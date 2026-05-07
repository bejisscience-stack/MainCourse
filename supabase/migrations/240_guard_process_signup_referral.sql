-- Migration 240: Add auth.uid() guard to process_signup_referral_on_enrollment
-- (final_security_guide A-10 / SEC-004).
--
-- The 3-arg variant of this RPC was SECURITY DEFINER, granted EXECUTE to the
-- authenticated role, and never compared p_user_id against auth.uid(). That let
-- an attacker pre-fire a victim's signup referral attribution by calling
-- POST /rest/v1/rpc/process_signup_referral_on_enrollment with the victim's
-- user_id and pending enrollment_request_id, racing the legitimate trigger and
-- denying the genuine referrer their commission via the
-- ON CONFLICT (referred_user_id, enrollment_request_id) DO NOTHING clause.
--
-- This migration mirrors the guard added to process_referral in mig 183:
-- the caller MUST be the user the RPC operates on. The single application
-- caller (app/api/enrollment-requests/route.ts:301) already passes
-- user.id from verifyTokenAndGetUser(token) using a cookie/JWT-bound client,
-- so auth.uid() resolves to user.id and the guard is a no-op for legitimate
-- traffic.
--
-- Function body below is preserved verbatim from the live staging definition;
-- only the guard was inserted immediately after BEGIN.

BEGIN;

CREATE OR REPLACE FUNCTION public.process_signup_referral_on_enrollment(
  p_user_id UUID,
  p_enrollment_request_id UUID,
  p_course_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_signup_ref_code TEXT;
  v_referrer_id UUID;
  v_referral_id UUID;
BEGIN
  -- Auth guard added in mig 240 (final_security_guide A-10).
  -- Mirrors process_referral (mig 183).
  IF auth.uid() IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

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
$$;

REVOKE ALL ON FUNCTION public.process_signup_referral_on_enrollment(UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_signup_referral_on_enrollment(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_signup_referral_on_enrollment(UUID, UUID, UUID) TO service_role;

COMMIT;
