-- Migration 243: Fix latent type-cast bug in admin approval RPCs
--
-- Discovered while testing migration 242. The two functions below pass
-- request_id::TEXT to credit_user_balance, but credit_user_balance.p_reference_id
-- is UUID. PostgreSQL has no text->uuid implicit cast, so the call resolves to:
--
--   function credit_user_balance(uuid, numeric, unknown, text) does not exist
--
-- This means admin "Approve" clicks have been failing on these paths since
-- migration 178 introduced the bad cast — the request stays 'pending' and the
-- lecturer is never credited via the admin path. (Keepz auto-credit uses
-- v_payment.reference_id directly as UUID, so payment-driven crediting still
-- works; that's why the platform isn't visibly broken.)
--
-- Fix: drop the ::TEXT cast on the third positional argument so request_id
-- (already UUID) is passed directly. Function bodies are otherwise identical
-- to migration 242 — same FOR UPDATE + status='pending' fence + GET DIAGNOSTICS
-- + bundle balance_transactions idempotency guard.

-- =============================================================================
-- approve_bundle_enrollment_request(uuid)  -- 1-arg overload
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

  SELECT EXISTS (
    SELECT 1 FROM balance_transactions
    WHERE reference_id = request_id AND source = 'course_purchase'
  ) INTO v_already_credited;

  IF NOT v_already_credited THEN
    v_platform_commission := ROUND(v_bundle.price * 0.03, 2);
    v_lecturer_amount := GREATEST(v_bundle.price - v_platform_commission, 0);

    PERFORM credit_user_balance(v_bundle.lecturer_id, v_lecturer_amount, 'course_purchase', request_id);

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
-- approve_enrollment_request(uuid)
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
    PERFORM credit_user_balance(v_referral.referrer_id, v_referrer_amount, 'referral_commission', request_id);
    PERFORM credit_user_balance(v_course.lecturer_id, v_lecturer_amount, 'course_purchase', request_id);
  ELSE
    v_lecturer_amount := GREATEST(v_course.price - v_platform_commission, 0);
    PERFORM credit_user_balance(v_course.lecturer_id, v_lecturer_amount, 'course_purchase', request_id);
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
