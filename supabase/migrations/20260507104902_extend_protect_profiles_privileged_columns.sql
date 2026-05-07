-- Extend protect_profiles_privileged_columns to cover the columns flagged
-- in final_security_guide.md A-1 (welcome_discount_expires_at) and A-8
-- (referral attribution + plaintext / encrypted PII columns).
--
-- The trigger definition itself is unchanged (BEFORE UPDATE on profiles).
-- We only replace the function body. The early-return guard
-- (current_user NOT IN ('authenticated', 'anon')) preserves all existing
-- service_role / postgres / SECURITY DEFINER bypass paths:
--   - handle_new_user (signup grants)
--   - approve_lecturer_account, credit/debit_user_balance (admin RPCs)
--   - /api/complete-profile, /api/balance, /api/account/delete and the
--     /api/admin/* routes that already use createServiceRoleClient
--   - trg_auto_encrypt_pii (SECURITY DEFINER) -- also fires AFTER this
--     trigger alphabetically, so it never runs on a rejected user UPDATE
--
-- Columns role and kyc_status remain protected by their own column-scoped
-- triggers (protect_profiles_role, protect_profiles_kyc_status from
-- migration 214) and are deliberately not duplicated here.

CREATE OR REPLACE FUNCTION public.protect_profiles_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF NEW.balance IS DISTINCT FROM OLD.balance THEN
    RAISE EXCEPTION
      'profiles.balance cannot be modified by users; use credit_user_balance/debit_user_balance'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.is_approved IS DISTINCT FROM OLD.is_approved THEN
    RAISE EXCEPTION
      'profiles.is_approved cannot be modified by users; use approve_lecturer_account'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.lecturer_status IS DISTINCT FROM OLD.lecturer_status THEN
    RAISE EXCEPTION
      'profiles.lecturer_status cannot be modified by users'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.project_access_expires_at IS DISTINCT FROM OLD.project_access_expires_at THEN
    RAISE EXCEPTION
      'profiles.project_access_expires_at cannot be modified by users'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.can_create_free_projects IS DISTINCT FROM OLD.can_create_free_projects THEN
    RAISE EXCEPTION
      'profiles.can_create_free_projects cannot be modified by users'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.profile_completed IS DISTINCT FROM OLD.profile_completed THEN
    RAISE EXCEPTION
      'profiles.profile_completed cannot be modified by users'
      USING ERRCODE = '42501';
  END IF;

  -- A-1: welcome discount expiry. Direct revenue-loss vector if user-mutable.
  IF NEW.welcome_discount_expires_at IS DISTINCT FROM OLD.welcome_discount_expires_at THEN
    RAISE EXCEPTION
      'profiles.welcome_discount_expires_at cannot be modified by users'
      USING ERRCODE = '42501';
  END IF;

  -- A-8: referral attribution. referral_code is set by
  -- auto_generate_referral_code() at INSERT only; signup_referral_code and
  -- referred_for_course_id are set by handle_new_user() at signup.
  IF NEW.referral_code IS DISTINCT FROM OLD.referral_code THEN
    RAISE EXCEPTION
      'profiles.referral_code cannot be modified by users'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.signup_referral_code IS DISTINCT FROM OLD.signup_referral_code THEN
    RAISE EXCEPTION
      'profiles.signup_referral_code cannot be modified by users'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.referred_for_course_id IS DISTINCT FROM OLD.referred_for_course_id THEN
    RAISE EXCEPTION
      'profiles.referred_for_course_id cannot be modified by users'
      USING ERRCODE = '42501';
  END IF;

  -- A-8: PII / impersonation surface. Plaintext columns are normally wiped
  -- to NULL by trg_auto_encrypt_pii after this trigger; blocking the
  -- plaintext write here also blocks the indirect path into encrypted_*.
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION
      'profiles.email cannot be modified by users'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.full_name IS DISTINCT FROM OLD.full_name THEN
    RAISE EXCEPTION
      'profiles.full_name cannot be modified by users'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.bank_account_number IS DISTINCT FROM OLD.bank_account_number THEN
    RAISE EXCEPTION
      'profiles.bank_account_number cannot be modified by users; use /api/balance'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.encrypted_email IS DISTINCT FROM OLD.encrypted_email THEN
    RAISE EXCEPTION
      'profiles.encrypted_email cannot be modified by users'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.encrypted_full_name IS DISTINCT FROM OLD.encrypted_full_name THEN
    RAISE EXCEPTION
      'profiles.encrypted_full_name cannot be modified by users'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.encrypted_bank_account_number IS DISTINCT FROM OLD.encrypted_bank_account_number THEN
    RAISE EXCEPTION
      'profiles.encrypted_bank_account_number cannot be modified by users'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;
