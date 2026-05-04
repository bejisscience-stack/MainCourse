-- Migration 207: Wire consent flags into handle_new_user() and get_admin_email_list()
--
-- Builds on migration 206 (consent columns) and migration 172 (handle_new_user
-- with role-injection guard). All other handle_new_user() behavior is preserved
-- verbatim from migration 172 — only the consent columns are added to the
-- INSERTs.
--
-- Email signup: terms_accepted is hardcoded TRUE (the form requires the user
-- to tick the box; we never trust user-supplied metadata to set it FALSE since
-- a registered account by definition agreed). marketing_emails_consent is read
-- from raw_user_meta_data->>'marketing_emails_consent'.
--
-- OAuth signup: both flags start FALSE. The /complete-profile page collects them
-- and writes via /api/complete-profile. ProfileCompletionGuard blocks OAuth users
-- from the rest of the app until profile_completed=true, so we never end up with
-- an "active" account that hasn't consented.

BEGIN;

-- ============================================================
-- Part 1: handle_new_user() — preserve migration 172 logic, add consent fields
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
      marketing_emails_consent, marketing_emails_consent_at
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
      CASE WHEN wants_marketing THEN NOW() ELSE NULL END  -- marketing_emails_consent_at
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
      marketing_emails_consent, marketing_emails_consent_at
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
      NULL
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- Part 2: get_admin_email_list() — expose marketing consent to admin UI
-- ============================================================
-- Adds one column: marketing_emails_consent BOOLEAN.
-- Profile rows expose the actual consent value; coming_soon rows return TRUE
-- (subscribers explicitly joined a marketing list by submitting that form).

CREATE OR REPLACE FUNCTION public.get_admin_email_list()
RETURNS TABLE (
  email TEXT,
  source TEXT,
  user_id UUID,
  full_name TEXT,
  username TEXT,
  role TEXT,
  is_registered BOOLEAN,
  registered_at TIMESTAMPTZ,
  has_enrollment BOOLEAN,
  enrolled_courses_count INT,
  last_email_sent_at TIMESTAMPTZ,
  total_emails_sent INT,
  marketing_emails_consent BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH
  profile_emails AS (
    SELECT
      LOWER(decrypted.email) AS email,
      p.id AS user_id,
      COALESCE(decrypted.full_name, p.full_name) AS full_name,
      p.username,
      p.role,
      p.created_at AS registered_at,
      p.marketing_emails_consent AS marketing_emails_consent
    FROM public.profiles p,
    LATERAL (
      SELECT
        public.decrypt_pii(p.encrypted_email) AS email,
        public.decrypt_pii(p.encrypted_full_name) AS full_name
    ) decrypted
    WHERE p.encrypted_email IS NOT NULL
      AND decrypted.email LIKE '%@%'
  ),
  cs_emails AS (
    SELECT LOWER(cs.email) AS email
    FROM public.coming_soon_emails cs
    WHERE cs.email IS NOT NULL AND cs.email LIKE '%@%'
  ),
  all_emails AS (
    SELECT
      COALESCE(pe.email, cs.email) AS email,
      CASE
        WHEN pe.email IS NOT NULL AND cs.email IS NOT NULL THEN 'both'
        WHEN pe.email IS NOT NULL THEN 'profile'
        ELSE 'coming_soon'
      END AS source,
      pe.user_id,
      pe.full_name,
      pe.username,
      pe.role,
      pe.user_id IS NOT NULL AS is_registered,
      pe.registered_at,
      -- Subscribers (coming_soon-only) implicitly consented by joining the list
      COALESCE(pe.marketing_emails_consent, TRUE) AS marketing_emails_consent
    FROM profile_emails pe
    FULL OUTER JOIN cs_emails cs ON pe.email = cs.email
  ),
  enrollment_counts AS (
    SELECT
      e.user_id,
      COUNT(*)::INT AS cnt
    FROM public.enrollments e
    GROUP BY e.user_id
  ),
  send_stats AS (
    SELECT
      LOWER(h.recipient_email) AS email,
      MAX(h.sent_at) AS last_sent,
      COUNT(*)::INT AS total_sent
    FROM public.email_send_history h
    GROUP BY LOWER(h.recipient_email)
  )
  SELECT
    ae.email,
    ae.source,
    ae.user_id,
    ae.full_name,
    ae.username,
    ae.role,
    ae.is_registered,
    ae.registered_at,
    COALESCE(ec.cnt > 0, FALSE) AS has_enrollment,
    COALESCE(ec.cnt, 0) AS enrolled_courses_count,
    ss.last_sent AS last_email_sent_at,
    COALESCE(ss.total_sent, 0) AS total_emails_sent,
    ae.marketing_emails_consent
  FROM all_emails ae
  LEFT JOIN enrollment_counts ec ON ae.user_id = ec.user_id
  LEFT JOIN send_stats ss ON ae.email = ss.email
  ORDER BY ae.email;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_email_list() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_admin_email_list() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_admin_email_list() FROM anon;

COMMIT;
