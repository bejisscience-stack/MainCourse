-- Migration 145: Fix Google OAuth Signup + PII Encryption search_path
--
-- Fixes:
-- A) handle_new_user() was regressed by migration 140 — restores full OAuth
--    handling from migration 104 and adds is_approved from migration 140
-- B) encrypt_pii() missing SET search_path (pgcrypto in extensions schema)
-- C) auto_encrypt_pii() missing SET search_path (calls encrypt_pii)

-- ============================================================================
-- PART 1: Restore correct handle_new_user() with OAuth + is_approved
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_username TEXT;
  signup_ref_code TEXT;
  signup_course_id TEXT;
  auth_provider TEXT;
BEGIN
  -- Detect auth provider (email, google, etc.)
  auth_provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');

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
      is_approved
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
      false,
      true,  -- email users have complete profiles at signup
      NOW() + INTERVAL '1 month',
      CASE WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'student') = 'lecturer' THEN false ELSE NULL END
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
      is_approved
    )
    VALUES (
      NEW.id,
      NEW.email,
      user_username,
      'student',
      false,
      false,  -- OAuth users must complete their profile
      NOW() + INTERVAL '1 month',
      NULL    -- students don't need approval
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 2: Fix encrypt_pii() search_path
-- ============================================================================

CREATE OR REPLACE FUNCTION public.encrypt_pii(p_value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key TEXT;
BEGIN
  IF p_value IS NULL OR p_value = '' THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'pii_encryption_key' LIMIT 1;
  IF v_key IS NULL OR v_key = '' THEN
    RETURN NULL;
  END IF;

  RETURN encode(pgp_sym_encrypt(p_value, v_key), 'base64');
END;
$$;

-- ============================================================================
-- PART 3: Fix auto_encrypt_pii() search_path
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_encrypt_pii()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (NEW.email IS NOT NULL AND NEW.email IS DISTINCT FROM OLD.email) THEN
    NEW.encrypted_email := public.encrypt_pii(NEW.email);
  END IF;
  NEW.email := NULL;

  IF TG_OP = 'INSERT' OR (NEW.full_name IS NOT NULL AND NEW.full_name IS DISTINCT FROM OLD.full_name) THEN
    NEW.encrypted_full_name := public.encrypt_pii(NEW.full_name);
  END IF;
  NEW.full_name := NULL;

  IF TG_OP = 'INSERT' OR (NEW.bank_account_number IS NOT NULL AND NEW.bank_account_number IS DISTINCT FROM OLD.bank_account_number) THEN
    NEW.encrypted_bank_account_number := public.encrypt_pii(NEW.bank_account_number);
  END IF;
  NEW.bank_account_number := NULL;

  RETURN NEW;
END;
$$;
