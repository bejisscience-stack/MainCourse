-- Migration 104: Grant 1-Month Project Access on Registration
--
-- Changes:
-- 1. Create has_project_access(uid) helper function
-- 2. Update handle_new_user() trigger to set project_access_expires_at on signup
-- 3. Backfill existing users without active access
-- 4. Add RLS policies for project-access-only users on 6 tables

-- ============================================================================
-- 1. has_project_access(uid) Helper Function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.has_project_access(uid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid
    AND project_access_expires_at > NOW()
  )
  OR EXISTS (
    SELECT 1 FROM public.project_subscriptions
    WHERE user_id = uid
    AND status = 'active'
    AND expires_at > NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_project_access(UUID) TO authenticated;

-- ============================================================================
-- 2. Update handle_new_user() Trigger — Add project_access_expires_at
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
    -- ===== Existing email signup logic =====
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
      project_access_expires_at
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
      NOW() + INTERVAL '1 month'
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
      project_access_expires_at
    )
    VALUES (
      NEW.id,
      NEW.email,
      user_username,
      'student',
      false,
      false,  -- OAuth users must complete their profile
      NOW() + INTERVAL '1 month'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. Backfill: Give existing users without active access a fresh 1-month window
-- ============================================================================

UPDATE public.profiles
SET project_access_expires_at = NOW() + INTERVAL '1 month'
WHERE project_access_expires_at IS NULL
   OR project_access_expires_at < NOW();

-- ============================================================================
-- 4. RLS Policies for Project-Access Users
-- ============================================================================

-- 4a. channels: SELECT only the "projects" channel
CREATE POLICY "Project access users can view projects channel"
  ON public.channels FOR SELECT
  USING (
    LOWER(name) = 'projects'
    AND has_project_access(auth.uid())
  );

-- 4b. messages: SELECT only messages in the "projects" channel
CREATE POLICY "Project access users can view project messages"
  ON public.messages FOR SELECT
  USING (
    has_project_access(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = channel_id
      AND LOWER(c.name) = 'projects'
    )
  );

-- 4c. projects: SELECT all projects
CREATE POLICY "Project access users can view projects"
  ON public.projects FOR SELECT
  USING (has_project_access(auth.uid()));

-- 4d. project_submissions: SELECT all submissions
CREATE POLICY "Project access users can view submissions"
  ON public.project_submissions FOR SELECT
  USING (has_project_access(auth.uid()));

-- 4e. project_submissions: INSERT own submissions (not lecturer/project-owner)
CREATE POLICY "Project access users can submit"
  ON public.project_submissions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND has_project_access(auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.courses c ON c.id = p.course_id
      WHERE p.id = project_id
      AND (c.lecturer_id = auth.uid() OR p.user_id = auth.uid())
    )
  );

-- 4f. project_criteria: SELECT all criteria
CREATE POLICY "Project access users can view criteria"
  ON public.project_criteria FOR SELECT
  USING (has_project_access(auth.uid()));

-- 4g. submission_reviews: SELECT all reviews
CREATE POLICY "Project access users can view reviews"
  ON public.submission_reviews FOR SELECT
  USING (has_project_access(auth.uid()));
