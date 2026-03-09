-- Migration 099: Project Subscription System + Lifetime Course Access
--
-- Changes:
-- 1. Backfill enrollments: set expires_at = NULL (lifetime access)
-- 2. Add project_access_expires_at column to profiles
-- 3. Create project_subscriptions table with RLS
-- 4. Update approve_enrollment_request() to grant 1-month project_access_expires_at on FIRST enrollment
-- 5. Update approve_bundle_enrollment_request() similarly
-- 6. Add approve_project_subscription() and reject_project_subscription() RPCs

-- ============================================================================
-- 1. Backfill: Lifetime Access for Enrollments
-- ============================================================================

UPDATE public.enrollments SET expires_at = NULL WHERE expires_at IS NOT NULL;

-- ============================================================================
-- 2. Add Project Access Column to Profiles
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS project_access_expires_at TIMESTAMPTZ NULL;

-- ============================================================================
-- 3. Create project_subscriptions Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.project_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  price DECIMAL(10,2) NOT NULL DEFAULT 10.00,
  payment_screenshot TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'expired', 'rejected')),
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_pending_per_user UNIQUE (user_id, status)
    WHERE status = 'pending'
);

-- Create index for common queries
CREATE INDEX idx_project_subscriptions_user_id ON public.project_subscriptions(user_id);
CREATE INDEX idx_project_subscriptions_status ON public.project_subscriptions(status);
CREATE INDEX idx_project_subscriptions_created_at ON public.project_subscriptions(created_at DESC);

-- Enable RLS
ALTER TABLE public.project_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subscriptions"
  ON public.project_subscriptions FOR SELECT
  USING (auth.uid() = user_id OR check_is_admin(auth.uid()));

CREATE POLICY "Users insert own subscriptions"
  ON public.project_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update subscriptions"
  ON public.project_subscriptions FOR UPDATE
  USING (check_is_admin(auth.uid()))
  WITH CHECK (check_is_admin(auth.uid()));

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_subscriptions;

-- ============================================================================
-- 4. Update approve_enrollment_request() — Lifetime Access + First Enrollment Bonus
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

  SELECT * INTO v_request FROM enrollment_requests WHERE id = request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

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
    '{"en":"Enrollment Approved","ge":"ჩარიცხვა დამტკიცდა"}'::jsonb,
    ('{"en":"You have been enrolled in ' || v_course.title || '","ge":"თქვენ ჩაირიცხეთ ' || v_course.title || '-ში"}'::jsonb),
    jsonb_build_object('course_id', v_course.id, 'request_id', request_id)
  );
END;
$$;

-- ============================================================================
-- 5. Update approve_bundle_enrollment_request() — Same Pattern
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

  SELECT * INTO v_request FROM bundle_enrollment_requests WHERE id = request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

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
    '{"en":"Bundle Enrollment Approved","ge":"ბান\u0301დელის ჩარიცხვა დამტკიცდა"}'::jsonb,
    ('{"en":"You have been enrolled in ' || v_bundle.title || '","ge":"თქვენ ჩაირიცხეთ ' || v_bundle.title || '-ში"}'::jsonb),
    jsonb_build_object('bundle_id', v_request.bundle_id, 'request_id', request_id)
  );
END;
$$;

-- ============================================================================
-- 6. New RPCs: Project Subscription Management
-- ============================================================================

CREATE OR REPLACE FUNCTION approve_project_subscription(subscription_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sub project_subscriptions%ROWTYPE;
BEGIN
  IF NOT check_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE project_subscriptions
    SET status = 'active',
        starts_at = NOW(),
        expires_at = NOW() + INTERVAL '1 month',
        approved_by = auth.uid(),
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = subscription_id
    RETURNING * INTO v_sub;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  -- Create notification
  PERFORM create_notification(
    v_sub.user_id,
    'subscription_approved',
    '{"en":"Project Subscription Approved","ge":"პროექტის გამოწერა დამტკიცდა"}'::jsonb,
    '{"en":"Your project subscription is now active!","ge":"თქვენი პროექტის გამოწერა ახლა აქტიური است!"}'::jsonb,
    jsonb_build_object('subscription_id', subscription_id, 'expires_at', v_sub.expires_at)
  );

  RETURN row_to_json(v_sub)::JSONB;
END;
$$;

CREATE OR REPLACE FUNCTION reject_project_subscription(subscription_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sub project_subscriptions%ROWTYPE;
BEGIN
  IF NOT check_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE project_subscriptions
    SET status = 'rejected', updated_at = NOW()
    WHERE id = subscription_id
    RETURNING * INTO v_sub;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  -- Create notification
  PERFORM create_notification(
    v_sub.user_id,
    'subscription_rejected',
    '{"en":"Project Subscription Rejected","ge":"პროექტის გამოწერა უარყოფილია"}'::jsonb,
    '{"en":"Your subscription was not approved. Please try again with a clearer screenshot.","ge":"თქვენი გამოწერა არ დამტკიცდა. სცადეთ კიდევ უფრო ნათელი სკრინშოტით."}'::jsonb,
    jsonb_build_object('subscription_id', subscription_id)
  );
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION approve_enrollment_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_bundle_enrollment_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_project_subscription(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_project_subscription(UUID) TO authenticated;
