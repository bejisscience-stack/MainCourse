-- Migration 171: Fix handle_new_user() regression from migration 170
--
-- Migration 170 replaced the full handle_new_user() (from migration 145) with a
-- simplified version missing required NOT NULL columns (username, etc.).
-- This caused "Database error saving new user" on all new Google OAuth signups.
--
-- Fix: Restore migration 145's complete logic + add lecturer_status from 170.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_username TEXT;
  signup_ref_code TEXT;
  signup_course_id TEXT;
  auth_provider TEXT;
  user_role TEXT;
BEGIN
  -- Detect auth provider (email, google, etc.)
  auth_provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'student');

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
      is_approved, lecturer_status
    )
    VALUES (
      NEW.id,
      NEW.email,
      user_username,
      user_role,
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
      CASE WHEN user_role = 'lecturer' THEN false ELSE NULL END,
      CASE WHEN user_role = 'lecturer' THEN 'pending' ELSE NULL END
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
      is_approved, lecturer_status
    )
    VALUES (
      NEW.id,
      NEW.email,
      user_username,
      'student',
      false,
      false,  -- OAuth users must complete their profile
      NOW() + INTERVAL '1 month',
      NULL,   -- students don't need approval
      NULL    -- not a lecturer
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
