-- Migration 131: Security audit fixes (SEC-02, SEC-03, SEC-04, SEC-08)
--
-- SEC-04: Add status = 'pending' check to enrollment approval RPCs to prevent double-credit
-- SEC-02: Restrict profile SELECT policy to hide balance/bank_account_number from other users
-- SEC-03: Drop direct INSERT policy on bundle_enrollments (should only go through approval RPC)
-- SEC-08: Add expires_at check to enrollment-based RLS policies on channels, videos, messages

-- ============================================================================
-- SEC-04: Fix approve_enrollment_request — require status = 'pending'
-- ============================================================================

CREATE OR REPLACE FUNCTION approve_enrollment_request(request_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_request enrollment_requests%ROWTYPE;
  v_course courses%ROWTYPE;
  v_referral referrals%ROWTYPE;
  v_commission DECIMAL;
  v_referrer_amount DECIMAL;
  v_lecturer_amount DECIMAL;
  v_is_first_enrollment BOOLEAN;
BEGIN
  IF NOT check_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- SEC-04: Only allow approving pending requests to prevent double-credit
  SELECT * INTO v_request FROM enrollment_requests WHERE id = request_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found or not pending'; END IF;

  SELECT * INTO v_course FROM courses WHERE id = v_request.course_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Course not found'; END IF;

  -- Calculate and distribute commission
  SELECT r.* INTO v_referral FROM referrals r
    WHERE r.enrollment_request_id = request_id LIMIT 1;

  IF FOUND AND v_course.referral_commission_percentage > 0 THEN
    v_commission := (v_course.referral_commission_percentage::DECIMAL / 100) * v_course.price;
    v_referrer_amount := v_commission;
    v_lecturer_amount := v_course.price - v_commission;

    PERFORM credit_user_balance(v_referral.referrer_id, v_referrer_amount, 'referral_commission', request_id::TEXT);
    PERFORM credit_user_balance(v_course.lecturer_id, v_lecturer_amount, 'course_sale', request_id::TEXT);
  ELSE
    PERFORM credit_user_balance(v_course.lecturer_id, v_course.price, 'course_sale', request_id::TEXT);
  END IF;

  -- Update enrollment request status
  UPDATE enrollment_requests
    SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = NOW()
    WHERE id = request_id;

  -- Insert or update enrollment (lifetime: no expires_at)
  INSERT INTO enrollments (user_id, course_id, approved_at)
    VALUES (v_request.user_id, v_request.course_id, NOW())
    ON CONFLICT (user_id, course_id) DO UPDATE SET approved_at = NOW();

  -- Grant project_access_expires_at ONLY on first-ever enrollment
  SELECT NOT EXISTS (
    SELECT 1 FROM enrollments
    WHERE user_id = v_request.user_id
    AND course_id != v_request.course_id
    AND approved_at IS NOT NULL
  ) INTO v_is_first_enrollment;

  IF v_is_first_enrollment THEN
    UPDATE profiles
      SET project_access_expires_at = NOW() + INTERVAL '1 month'
      WHERE id = v_request.user_id
      AND (project_access_expires_at IS NULL OR project_access_expires_at < NOW());
  END IF;

  -- Create notification
  PERFORM create_notification(
    v_request.user_id,
    'enrollment_approved',
    'Enrollment Approved',
    'ჩარიცხვა დამტკიცდა',
    'You have been enrolled in ' || v_course.title,
    'თქვენ ჩაირიცხეთ ' || v_course.title || '-ში',
    jsonb_build_object('course_id', v_course.id, 'request_id', request_id),
    auth.uid()
  );
END;
$$;

-- ============================================================================
-- SEC-04: Fix approve_bundle_enrollment_request — require status = 'pending'
-- ============================================================================

CREATE OR REPLACE FUNCTION approve_bundle_enrollment_request(request_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_request bundle_enrollment_requests%ROWTYPE;
  v_bundle course_bundles%ROWTYPE;
  v_course_id UUID;
  v_is_first_enrollment BOOLEAN;
BEGIN
  IF NOT check_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- SEC-04: Only allow approving pending requests to prevent double-credit
  SELECT * INTO v_request FROM bundle_enrollment_requests WHERE id = request_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found or not pending'; END IF;

  SELECT * INTO v_bundle FROM course_bundles WHERE id = v_request.bundle_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bundle not found'; END IF;

  -- Credit lecturer balance
  PERFORM credit_user_balance(v_bundle.lecturer_id, v_bundle.price, 'bundle_sale', request_id::TEXT);

  -- Update request status
  UPDATE bundle_enrollment_requests
    SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = NOW()
    WHERE id = request_id;

  -- Enroll in all courses in bundle (lifetime: no expires_at)
  FOR v_course_id IN SELECT course_id FROM bundle_courses WHERE bundle_id = v_request.bundle_id LOOP
    INSERT INTO enrollments (user_id, course_id, approved_at)
      VALUES (v_request.user_id, v_course_id, NOW())
      ON CONFLICT (user_id, course_id) DO UPDATE SET approved_at = NOW();
  END LOOP;

  -- Grant project_access_expires_at on FIRST enrollment
  SELECT NOT EXISTS (
    SELECT 1 FROM enrollments
    WHERE user_id = v_request.user_id
    AND approved_at IS NOT NULL
  ) INTO v_is_first_enrollment;

  IF v_is_first_enrollment THEN
    UPDATE profiles
      SET project_access_expires_at = NOW() + INTERVAL '1 month'
      WHERE id = v_request.user_id
      AND (project_access_expires_at IS NULL OR project_access_expires_at < NOW());
  END IF;

  -- Create notification
  PERFORM create_notification(
    v_request.user_id,
    'bundle_enrollment_approved',
    'Bundle Enrollment Approved',
    'ბანდელის ჩარიცხვა დამტკიცდა',
    'You have been enrolled in ' || v_bundle.title,
    'თქვენ ჩაირიცხეთ ' || v_bundle.title || '-ში',
    jsonb_build_object('bundle_id', v_request.bundle_id, 'request_id', request_id),
    auth.uid()
  );
END;
$$;

-- ============================================================================
-- SEC-02: Restrict profile SELECT to hide balance/bank_account_number
--
-- Current state (after migrations 036 + 061):
--   1. "Users can view own profile" (auth.uid() = id) — migration 036
--   2. "Admins can view all profiles" (check_is_admin(auth.uid())) — migration 036
--   3. "Users can view profile usernames" (auth.uid() IS NOT NULL) — migration 061
--
-- Policy 3 is overly permissive — ANY authenticated user can SELECT ALL columns
-- from ALL profiles, exposing balance and bank_account_number.
--
-- Fix: Drop policy 3. Add same-course enrollment policy so users can still see
-- classmates' profiles (needed for chat usernames, submissions, etc.).
-- Also create a public_profiles view exposing only safe columns.
-- ============================================================================

-- Drop the overly-permissive policy
DROP POLICY IF EXISTS "Users can view profile usernames" ON public.profiles;

-- Policies 1 and 2 from migration 036 already exist:
-- "Users can view own profile" and "Admins can view all profiles"

-- Add: users can see profiles of classmates (co-enrolled in same course)
CREATE POLICY "Users can view co-enrolled profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments e1
      JOIN public.enrollments e2 ON e1.course_id = e2.course_id
      WHERE e1.user_id = auth.uid()
      AND e2.user_id = profiles.id
    )
  );

-- Add: lecturers can see profiles of students in their courses
CREATE POLICY "Lecturers can view student profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      JOIN public.enrollments e ON e.course_id = c.id
      WHERE c.lecturer_id = auth.uid()
      AND e.user_id = profiles.id
    )
  );

-- Create a view with only safe columns as recommended interface for cross-user queries
CREATE OR REPLACE VIEW public.public_profiles AS
  SELECT id, username, email, avatar_url, role
  FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated;

-- ============================================================================
-- SEC-03: Drop direct INSERT policy on bundle_enrollments
-- Enrollments should only happen through approve_bundle_enrollment_request() RPC
-- ============================================================================

DROP POLICY IF EXISTS "Users can insert own bundle enrollments" ON public.bundle_enrollments;

-- ============================================================================
-- SEC-08: Add expires_at check to enrollment-based RLS policies
-- Users with expired enrollments should not access course content
-- ============================================================================

-- Channels: drop and recreate with expires_at check
DROP POLICY IF EXISTS "Enrolled users can view channels" ON public.channels;
CREATE POLICY "Enrolled users can view channels"
  ON public.channels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE enrollments.course_id = channels.course_id
      AND enrollments.user_id = auth.uid()
      AND (enrollments.expires_at IS NULL OR enrollments.expires_at > NOW())
    )
  );

-- Videos: drop and recreate with expires_at check
DROP POLICY IF EXISTS "Enrolled users can view videos" ON public.videos;
CREATE POLICY "Enrolled users can view videos"
  ON public.videos FOR SELECT
  USING (
    is_published = true AND
    EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE enrollments.course_id = videos.course_id
      AND enrollments.user_id = auth.uid()
      AND (enrollments.expires_at IS NULL OR enrollments.expires_at > NOW())
    )
  );

-- Messages: drop and recreate with expires_at check
DROP POLICY IF EXISTS "Enrolled users can view messages" ON public.messages;
CREATE POLICY "Enrolled users can view messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE enrollments.course_id = messages.course_id
      AND enrollments.user_id = auth.uid()
      AND (enrollments.expires_at IS NULL OR enrollments.expires_at > NOW())
    )
  );

-- Also fix the INSERT policy for messages (users shouldn't post in expired courses)
DROP POLICY IF EXISTS "Enrolled users can insert messages" ON public.messages;
CREATE POLICY "Enrolled users can insert messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE enrollments.course_id = messages.course_id
      AND enrollments.user_id = auth.uid()
      AND (enrollments.expires_at IS NULL OR enrollments.expires_at > NOW())
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.channels
      WHERE channels.id = messages.channel_id
      AND channels.type IN ('lectures', 'projects')
    )
  );
