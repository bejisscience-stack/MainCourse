-- Migration 105: Fix project access data + remove global access grant from enrollment RPCs
--
-- Problems fixed:
-- 1. Migration 104 backfill set ALL users' project_access_expires_at to NOW() + 1 month,
--    regardless of registration date. This gave expired users a fresh month of access.
-- 2. approve_enrollment_request() and approve_bundle_enrollment_request() granted global
--    project access on first enrollment. Enrollment should only grant course-specific access.
--
-- After this migration:
-- - project_access_expires_at = created_at + 1 month (free period from registration)
-- - Enrollment grants access to that course's projects only (handled by app code)
-- - Global project access requires a paid subscription (₾10/month)

-- ============================================================================
-- 1. Fix project_access_expires_at — base on actual registration date
-- ============================================================================

UPDATE profiles
SET project_access_expires_at = created_at + INTERVAL '1 month';

-- ============================================================================
-- 2. Recreate approve_enrollment_request() — remove global project access grant
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
-- 3. Recreate approve_bundle_enrollment_request() — remove global project access grant
-- ============================================================================

CREATE OR REPLACE FUNCTION approve_bundle_enrollment_request(request_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_request bundle_enrollment_requests%ROWTYPE;
  v_bundle course_bundles%ROWTYPE;
  v_course_id UUID;
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

  -- Create notification
  PERFORM create_notification(
    v_request.user_id,
    'bundle_enrollment_approved',
    '{"en":"Bundle Enrollment Approved","ge":"ბანდელის ჩარიცხვა დამტკიცდა"}'::jsonb,
    ('{"en":"You have been enrolled in ' || v_bundle.title || '","ge":"თქვენ ჩაირიცხეთ ' || v_bundle.title || '-ში"}'::jsonb),
    jsonb_build_object('bundle_id', v_request.bundle_id, 'request_id', request_id)
  );
END;
$$;
