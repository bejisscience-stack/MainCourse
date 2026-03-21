-- Migration 172: Fix privilege escalation via signup role injection (SEC-01)
--
-- Vulnerability: handle_new_user() reads `role` from user-supplied metadata:
--   user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'student');
-- An attacker can call supabase.auth.signUp({ options: { data: { role: 'admin' } } })
-- and get admin access.
--
-- Fix: Always insert role='student'. If user requested 'lecturer', only set
-- lecturer_status='pending' + is_approved=false. Admin approval (which already
-- exists) promotes role to 'lecturer' via approve_lecturer_account().

-- 1. Replace handle_new_user() — hardcode role='student', never trust metadata for role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_username TEXT;
  signup_ref_code TEXT;
  signup_course_id TEXT;
  auth_provider TEXT;
  wants_lecturer BOOLEAN;
BEGIN
  -- Detect auth provider (email, google, etc.)
  auth_provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');
  -- Only use metadata role as a *flag* for lecturer application, never as actual role
  wants_lecturer := (NEW.raw_user_meta_data->>'role' = 'lecturer');

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
      CASE WHEN wants_lecturer THEN 'pending' ELSE NULL END
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
      'student',  -- ALWAYS student
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


-- 2. Replace approve_lecturer_account() — now promotes role to 'lecturer'
--    and matches on lecturer_status='pending' (since applicants have role='student')
CREATE OR REPLACE FUNCTION public.approve_lecturer_account(p_user_id UUID)
RETURNS void AS $$
BEGIN
  IF NOT public.check_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can approve lecturer accounts';
  END IF;

  UPDATE public.profiles
  SET role = 'lecturer', is_approved = true, lecturer_status = 'approved', updated_at = NOW()
  WHERE id = p_user_id AND lecturer_status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending lecturer profile not found for user %', p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Replace reject_lecturer_account() — match on lecturer_status='pending'
CREATE OR REPLACE FUNCTION public.reject_lecturer_account(p_user_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS void AS $$
BEGIN
  IF NOT public.check_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can reject lecturer accounts';
  END IF;

  UPDATE public.profiles
  SET is_approved = false, lecturer_status = 'rejected', updated_at = NOW()
  WHERE id = p_user_id AND lecturer_status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending lecturer profile not found for user %', p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Replace get_pending_lecturers() — find applicants by lecturer_status, not role
DROP FUNCTION IF EXISTS public.get_pending_lecturers();

CREATE OR REPLACE FUNCTION public.get_pending_lecturers()
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  username TEXT,
  is_approved BOOLEAN,
  lecturer_status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT public.check_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can view pending lecturers';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    COALESCE(public.decrypt_pii(p.encrypted_email), p.email) AS email,
    COALESCE(public.decrypt_pii(p.encrypted_full_name), p.full_name) AS full_name,
    p.username,
    p.is_approved,
    p.lecturer_status,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  WHERE p.lecturer_status IS NOT NULL
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE;
