-- Migration 242: Atomic & idempotent admin approval/rejection RPCs
--
-- Closes audit findings A-6 and A-7 from final_security_guide.md.
--
-- Five admin RPCs are made race-safe and double-click safe by:
--   1. SELECT ... WHERE id = ? AND status = 'pending' FOR UPDATE
--   2. AND status = 'pending' on the UPDATE + GET DIAGNOSTICS ROW_COUNT
--   3. RAISE EXCEPTION '... not found or already processed' on either fence miss
--
-- Pattern matches existing safe functions: approve_withdrawal_request (mig 162)
-- and approve_kyc_submission / reject_kyc_submission (mig 216).
--
-- For the bundle 1-arg path we additionally guard credit_user_balance + the
-- per-course enrollments inserts behind a NOT EXISTS balance_transactions
-- check (mirrors the Keepz-recovery idempotency pattern in mig 210), so the
-- admin-approve path is also safe against a prior Keepz credit on the same
-- request_id.
--
-- Side effects (notification, profile extension, enrollments insert/upsert,
-- DELETE on reject, commission split) are preserved verbatim — only the
-- locking and fencing logic changes. UI behavior is unchanged: routes return
-- 500 on the new "already processed" RAISE, which the admin UI already
-- renders as an error toast.

-- =============================================================================
-- 1. approve_project_subscription(uuid)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.approve_project_subscription(subscription_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sub project_subscriptions%ROWTYPE;
  v_count integer;
BEGIN
  IF NOT check_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_sub
  FROM project_subscriptions
  WHERE id = subscription_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found or already processed';
  END IF;

  UPDATE project_subscriptions
    SET status = 'active',
        starts_at = NOW(),
        expires_at = NOW() + INTERVAL '1 month',
        approved_by = auth.uid(),
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = subscription_id AND status = 'pending'
    RETURNING * INTO v_sub;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Subscription not found or already processed';
  END IF;

  UPDATE profiles
    SET project_access_expires_at = GREATEST(
          COALESCE(project_access_expires_at, NOW()),
          NOW()
        ) + INTERVAL '1 month'
    WHERE id = v_sub.user_id;

  PERFORM create_notification(
    v_sub.user_id,
    'subscription_approved',
    'Project Subscription Approved',
    'პროექტის გამოწერა დამტკიცდა',
    'Your project subscription is now active!',
    'თქვენი პროექტის გამოწერა ახლა აქტიურია!',
    jsonb_build_object('subscription_id', subscription_id, 'expires_at', v_sub.expires_at),
    auth.uid()
  );

  RETURN jsonb_build_object('success', true, 'subscription', row_to_json(v_sub));
END;
$$;

-- =============================================================================
-- 2. approve_bundle_enrollment_request(uuid)  -- 1-arg overload
-- =============================================================================
CREATE OR REPLACE FUNCTION public.approve_bundle_enrollment_request(request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request bundle_enrollment_requests%ROWTYPE;
  v_bundle course_bundles%ROWTYPE;
  v_course_id UUID;
  v_platform_commission DECIMAL;
  v_lecturer_amount DECIMAL;
  v_count integer;
  v_already_credited boolean;
BEGIN
  IF NOT check_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_request
  FROM bundle_enrollment_requests
  WHERE id = request_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bundle enrollment request not found or already processed';
  END IF;

  SELECT * INTO v_bundle FROM course_bundles WHERE id = v_request.bundle_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bundle not found'; END IF;

  UPDATE bundle_enrollment_requests
    SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = NOW()
    WHERE id = request_id AND status = 'pending';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Bundle enrollment request not found or already processed';
  END IF;

  -- Idempotency: if balance was already credited for this request_id (e.g. via
  -- complete_keepz_payment), skip credit + enrollment + notification side-effects.
  SELECT EXISTS (
    SELECT 1 FROM balance_transactions
    WHERE reference_id = request_id AND source = 'course_purchase'
  ) INTO v_already_credited;

  IF NOT v_already_credited THEN
    v_platform_commission := ROUND(v_bundle.price * 0.03, 2);
    v_lecturer_amount := GREATEST(v_bundle.price - v_platform_commission, 0);

    PERFORM credit_user_balance(v_bundle.lecturer_id, v_lecturer_amount, 'course_purchase', request_id::TEXT);

    FOR v_course_id IN SELECT course_id FROM bundle_courses WHERE bundle_id = v_request.bundle_id LOOP
      INSERT INTO enrollments (user_id, course_id, approved_at)
        VALUES (v_request.user_id, v_course_id, NOW())
        ON CONFLICT (user_id, course_id) DO UPDATE SET approved_at = NOW();
    END LOOP;

    PERFORM create_notification(
      v_request.user_id, 'bundle_enrollment_approved',
      'Bundle Enrollment Approved', 'ბანდელის ჩარიცხვა დამტკიცდა',
      'You have been enrolled in ' || v_bundle.title,
      'თქვენ ჩაირიცხეთ ' || v_bundle.title || '-ში',
      jsonb_build_object('bundle_id', v_request.bundle_id, 'request_id', request_id),
      auth.uid()
    );
  END IF;
END;
$$;

-- =============================================================================
-- 3. approve_bundle_enrollment_request(uuid, uuid)  -- 2-arg overload
-- =============================================================================
CREATE OR REPLACE FUNCTION public.approve_bundle_enrollment_request(request_id uuid, admin_user_id uuid DEFAULT NULL::uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  request_record public.bundle_enrollment_requests%ROWTYPE;
  bundle_course RECORD;
  update_count INTEGER;
  actual_admin_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  actual_admin_id := COALESCE(admin_user_id, auth.uid());

  IF admin_user_id IS NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = actual_admin_id
      AND profiles.role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Only admins can approve bundle enrollment requests';
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = actual_admin_id
      AND profiles.role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Provided user ID is not an admin';
    END IF;
  END IF;

  v_expires_at := TIMEZONE('utc', NOW()) + INTERVAL '1 month';

  SELECT * INTO request_record
  FROM public.bundle_enrollment_requests
  WHERE id = request_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bundle enrollment request not found or already processed';
  END IF;

  UPDATE public.bundle_enrollment_requests
  SET
    status = 'approved',
    reviewed_by = actual_admin_id,
    reviewed_at = TIMEZONE('utc', NOW())
  WHERE id = request_id AND status = 'pending';

  GET DIAGNOSTICS update_count = ROW_COUNT;

  IF update_count = 0 THEN
    RAISE EXCEPTION 'Bundle enrollment request not found or already processed';
  END IF;

  INSERT INTO public.bundle_enrollments (user_id, bundle_id)
  VALUES (request_record.user_id, request_record.bundle_id)
  ON CONFLICT (user_id, bundle_id) DO NOTHING;

  FOR bundle_course IN
    SELECT course_id FROM public.course_bundle_items
    WHERE bundle_id = request_record.bundle_id
  LOOP
    INSERT INTO public.enrollments (user_id, course_id, expires_at)
    VALUES (request_record.user_id, bundle_course.course_id, v_expires_at)
    ON CONFLICT (user_id, course_id) DO UPDATE
    SET expires_at = v_expires_at;
  END LOOP;
END;
$$;

-- =============================================================================
-- 4. approve_enrollment_request(uuid)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.approve_enrollment_request(request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request enrollment_requests%ROWTYPE;
  v_course courses%ROWTYPE;
  v_referral referrals%ROWTYPE;
  v_commission DECIMAL;
  v_referrer_amount DECIMAL;
  v_lecturer_amount DECIMAL;
  v_platform_commission DECIMAL;
  v_count integer;
BEGIN
  IF NOT check_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_request
  FROM enrollment_requests
  WHERE id = request_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already processed';
  END IF;

  SELECT * INTO v_course FROM courses WHERE id = v_request.course_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Course not found'; END IF;

  -- Flip status before side effects so a fence miss aborts the credits too.
  UPDATE enrollment_requests
    SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = NOW()
    WHERE id = request_id AND status = 'pending';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Request not found or already processed';
  END IF;

  v_platform_commission := ROUND(v_course.price * 0.03, 2);

  SELECT r.* INTO v_referral FROM referrals r
    WHERE r.enrollment_request_id = request_id LIMIT 1;

  IF FOUND AND v_course.referral_commission_percentage > 0 THEN
    v_commission := (v_course.referral_commission_percentage::DECIMAL / 100) * v_course.price;
    v_referrer_amount := v_commission;
    v_lecturer_amount := GREATEST(v_course.price - v_platform_commission - v_commission, 0);
    PERFORM credit_user_balance(v_referral.referrer_id, v_referrer_amount, 'referral_commission', request_id::TEXT);
    PERFORM credit_user_balance(v_course.lecturer_id, v_lecturer_amount, 'course_purchase', request_id::TEXT);
  ELSE
    v_lecturer_amount := GREATEST(v_course.price - v_platform_commission, 0);
    PERFORM credit_user_balance(v_course.lecturer_id, v_lecturer_amount, 'course_purchase', request_id::TEXT);
  END IF;

  INSERT INTO enrollments (user_id, course_id, approved_at)
    VALUES (v_request.user_id, v_request.course_id, NOW())
    ON CONFLICT (user_id, course_id) DO UPDATE SET approved_at = NOW();

  PERFORM create_notification(
    v_request.user_id, 'enrollment_approved',
    'Enrollment Approved', 'ჩარიცხვა დამტკიცდა',
    'You have been enrolled in ' || v_course.title,
    'თქვენ ჩაირიცხეთ ' || v_course.title || '-ში',
    jsonb_build_object('course_id', v_course.id, 'request_id', request_id),
    auth.uid()
  );
END;
$$;

-- =============================================================================
-- 5. reject_enrollment_request(uuid)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.reject_enrollment_request(request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  request_record public.enrollment_requests%ROWTYPE;
  admin_user_id UUID;
  is_admin BOOLEAN;
  v_count integer;
BEGIN
  SELECT public.check_is_admin(auth.uid()) INTO is_admin;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Only admins can reject enrollment requests';
  END IF;

  admin_user_id := auth.uid();

  SELECT * INTO request_record
  FROM public.enrollment_requests
  WHERE id = request_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment request not found or already processed';
  END IF;

  UPDATE public.enrollment_requests
  SET
    status = 'rejected',
    reviewed_by = admin_user_id,
    reviewed_at = TIMEZONE('utc', NOW()),
    updated_at = TIMEZONE('utc', NOW())
  WHERE id = request_id AND status = 'pending';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Enrollment request not found or already processed';
  END IF;

  DELETE FROM public.enrollments
  WHERE user_id = request_record.user_id
    AND course_id = request_record.course_id;
END;
$$;
