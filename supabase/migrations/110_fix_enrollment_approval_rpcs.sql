-- Migration 110: Fix create_notification calls in enrollment approval RPCs
--
-- The create_notification function signature is:
--   create_notification(p_user_id uuid, p_type text, p_title_en text, p_title_ge text,
--                       p_message_en text, p_message_ge text, p_metadata jsonb, p_created_by uuid)
--
-- Migration 099 passed JSONB objects for title/message (5 args) instead of separate TEXT params (8 args).
-- Migration 106 fixed this for approve_project_subscription / reject_project_subscription but missed
-- approve_enrollment_request and approve_bundle_enrollment_request.

-- ============================================================================
-- 1. Fix approve_enrollment_request
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

  -- Create notification (8 separate args matching create_notification signature)
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
-- 2. Fix approve_bundle_enrollment_request
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

  -- Create notification (8 separate args matching create_notification signature)
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
