-- Migration 183: SET search_path on SECURITY DEFINER functions + auth guard on process_referral
-- Addresses: CRIT-01, CRIT-03, CRIT-04, HIGH-01, HIGH-02 from security audit
--
-- search_path = public, pg_temp prevents search_path manipulation attacks
-- on all SECURITY DEFINER functions. pg_temp is included so temporary objects
-- cannot shadow public-schema objects.

BEGIN;

-- ============================================================
-- Part 1: ALTER all SECURITY DEFINER functions to SET search_path
-- ============================================================

ALTER FUNCTION public.check_is_admin(UUID)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.has_project_access(UUID)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.approve_enrollment_request(UUID)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.reject_enrollment_request(UUID)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.approve_withdrawal_request(UUID, TEXT)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.reject_withdrawal_request(UUID, TEXT)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.approve_lecturer_account(UUID)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.reject_lecturer_account(UUID, TEXT)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.create_withdrawal_request(DECIMAL, TEXT)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.credit_user_balance(UUID, NUMERIC, TEXT, UUID, TEXT, TEXT)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.debit_user_balance(UUID, NUMERIC, TEXT, UUID, TEXT, TEXT)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.get_user_balance_info(UUID)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.complete_keepz_payment(UUID, JSONB)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.process_signup_referral_on_enrollment(UUID, UUID, UUID)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.create_referral_safe(TEXT, UUID, UUID, UUID)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.get_enrollment_requests_admin(TEXT)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.get_bundle_enrollment_requests_admin(TEXT)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.get_enrollment_requests_count()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.get_pending_lecturers()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.get_withdrawal_requests_admin(TEXT)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.get_safe_profiles(UUID[])
  SET search_path = public, pg_temp;

ALTER FUNCTION public.update_own_profile(TEXT, TEXT)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.mark_all_notifications_read(UUID)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.get_unread_notification_count(UUID)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.approve_bundle_enrollment_request(UUID)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.approve_bundle_enrollment_request(UUID, UUID)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.reject_bundle_enrollment_request(UUID, UUID)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.approve_project_subscription(UUID)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.reject_project_subscription(UUID)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.insert_audit_log(UUID, TEXT, TEXT, TEXT, JSONB, TEXT)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.log_payment_event(UUID, UUID, UUID, TEXT, JSONB)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.get_profiles_for_friend_requests(UUID[])
  SET search_path = public, pg_temp;

ALTER FUNCTION public.pay_submission(UUID, NUMERIC, UUID, UUID)
  SET search_path = public, pg_temp;

-- Trigger functions
ALTER FUNCTION public.handle_new_user()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.auto_encrypt_pii()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.encrypt_withdrawal_bank_account()
  SET search_path = public, pg_temp;

-- Referral helper functions (not SECURITY DEFINER but still good practice)
ALTER FUNCTION public.generate_referral_code()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.auto_generate_referral_code()
  SET search_path = public, pg_temp;

-- ============================================================
-- Part 2: Functions with uncertain existence — wrap in DO block
-- ============================================================

DO $$
BEGIN
  EXECUTE 'ALTER FUNCTION public.search_users_by_email(TEXT, UUID, INTEGER) SET search_path = public, pg_temp';
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'search_users_by_email(TEXT, UUID, INTEGER) does not exist — skipping';
END;
$$;

DO $$
BEGIN
  EXECUTE 'ALTER FUNCTION public.get_profiles_for_friends(UUID[]) SET search_path = public, pg_temp';
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'get_profiles_for_friends(UUID[]) does not exist — skipping';
END;
$$;

-- ============================================================
-- Part 3: Cron-schema functions — add pg_temp while keeping cron
-- ============================================================

ALTER FUNCTION public.get_view_scraper_schedule()
  SET search_path = public, cron, pg_temp;

ALTER FUNCTION public.update_view_scraper_schedule(TEXT, BOOLEAN)
  SET search_path = public, cron, pg_temp;

-- ============================================================
-- Part 4: CREATE OR REPLACE process_referral with auth.uid() guard (HIGH-02)
-- ============================================================

CREATE OR REPLACE FUNCTION public.process_referral(
  p_referral_code TEXT,
  p_referred_user_id UUID,
  p_enrollment_request_id UUID,
  p_course_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_referrer_id UUID;
  v_referral_id UUID;
BEGIN
  -- HIGH-02: Ensure the caller is the referred user
  IF p_referred_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: referred user must be the caller';
  END IF;

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
$$;

COMMIT;
