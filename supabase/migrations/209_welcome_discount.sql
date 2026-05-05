-- Migration 209: 12-hour welcome discount window per user
--
-- Adds profiles.welcome_discount_expires_at to track each user's personal
-- 12-hour discount window. While NOW() < welcome_discount_expires_at, the
-- user is offered courses.price (and course_bundles.price) as a discounted
-- price; otherwise they pay courses.original_price (or course_bundles.original_price)
-- when one is set.
--
-- Existing users get a fresh 12h window on this migration's apply (one-time
-- goodwill). New users get the window set by handle_new_user(). The trigger
-- body is preserved verbatim from migration 207 — only the new column is added
-- to the column list and VALUES tuple in both branches (email + OAuth).
-- See CLAUDE.md: this trigger is critical, never replace with a simplified version.

BEGIN;

-- ============================================================
-- Part 1: Schema change + backfill
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_discount_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.welcome_discount_expires_at IS
  '12-hour welcome discount window expiry. While NOW() < this, user is offered '
  'the discounted price (courses.price). NULL means ineligible (admin-cleared).';

UPDATE public.profiles
SET welcome_discount_expires_at = NOW() + INTERVAL '12 hours'
WHERE welcome_discount_expires_at IS NULL;

-- ============================================================
-- Part 2: handle_new_user() — preserve migration 207 logic, add new column
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  user_username TEXT;
  signup_ref_code TEXT;
  signup_course_id TEXT;
  auth_provider TEXT;
  wants_lecturer BOOLEAN;
  wants_marketing BOOLEAN;
BEGIN
  -- Detect auth provider (email, google, etc.)
  auth_provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');
  -- Only use metadata role as a *flag* for lecturer application, never as actual role
  wants_lecturer := (NEW.raw_user_meta_data->>'role' = 'lecturer');
  -- Marketing consent: explicit boolean from signup form, defaults FALSE
  wants_marketing := COALESCE(
    (NEW.raw_user_meta_data->>'marketing_emails_consent')::BOOLEAN,
    FALSE
  );

  IF auth_provider = 'email' THEN
    -- ===== Email signup logic =====
    user_username := NEW.raw_user_meta_data->>'username';
    signup_ref_code := NEW.raw_user_meta_data->>'signup_referral_code';
    signup_course_id := NEW.raw_user_meta_data->>'signup_course_id';

    IF user_username IS NULL OR TRIM(user_username) = '' THEN
      RAISE EXCEPTION 'Username is required for registration';
    END IF;

    user_username := TRIM(user_username);

    IF LENGTH(user_username) < 3 OR LENGTH(user_username) > 30 THEN
      RAISE EXCEPTION 'Username must be between 3 and 30 characters';
    END IF;

    IF NOT (user_username ~ '^[a-zA-Z0-9_]+$') THEN
      RAISE EXCEPTION 'Username can only contain letters, numbers, and underscores';
    END IF;

    IF EXISTS (SELECT 1 FROM public.profiles WHERE username = user_username) THEN
      RAISE EXCEPTION 'Username already exists. Please choose a different username.';
    END IF;

    INSERT INTO public.profiles (
      id, email, username, role,
      signup_referral_code, referred_for_course_id,
      first_login_completed, profile_completed,
      project_access_expires_at,
      is_approved, lecturer_status,
      terms_accepted, terms_accepted_at,
      marketing_emails_consent, marketing_emails_consent_at,
      welcome_discount_expires_at
    )
    VALUES (
      NEW.id,
      NEW.email,
      user_username,
      'student',  -- ALWAYS student — never trust user-supplied role
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
      false,
      true,  -- email users have complete profiles at signup
      NOW() + INTERVAL '1 month',
      CASE WHEN wants_lecturer THEN false ELSE NULL END,
      CASE WHEN wants_lecturer THEN 'pending' ELSE NULL END,
      true,                                    -- terms_accepted: form-enforced, hardcoded
      NOW(),                                   -- terms_accepted_at
      wants_marketing,                         -- marketing_emails_consent
      CASE WHEN wants_marketing THEN NOW() ELSE NULL END,  -- marketing_emails_consent_at
      NOW() + INTERVAL '12 hours'              -- welcome_discount_expires_at
    );

  ELSE
    -- ===== OAuth signup (Google, etc.) =====
    -- Auto-generate a temporary username from UUID prefix
    user_username := 'user_' || REPLACE(LEFT(NEW.id::TEXT, 8), '-', '');

    -- Ensure uniqueness (extremely unlikely collision, but safe)
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = user_username) LOOP
      user_username := 'user_' || REPLACE(LEFT(NEW.id::TEXT, 8), '-', '') || '_' || floor(random() * 1000)::TEXT;
    END LOOP;

    INSERT INTO public.profiles (
      id, email, username, role,
      first_login_completed, profile_completed,
      project_access_expires_at,
      is_approved, lecturer_status,
      terms_accepted, terms_accepted_at,
      marketing_emails_consent, marketing_emails_consent_at,
      welcome_discount_expires_at
    )
    VALUES (
      NEW.id,
      NEW.email,
      user_username,
      'student',  -- ALWAYS student
      false,
      false,  -- OAuth users must complete their profile
      NOW() + INTERVAL '1 month',
      NULL,   -- students don't need approval
      NULL,   -- not a lecturer
      false,  -- terms_accepted: collected on /complete-profile
      NULL,
      false,  -- marketing_emails_consent: collected on /complete-profile
      NULL,
      NOW() + INTERVAL '12 hours'  -- welcome_discount_expires_at
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
