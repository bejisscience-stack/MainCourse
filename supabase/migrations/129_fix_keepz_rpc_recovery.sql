-- Migration 129: Fix complete_keepz_payment RPC recovery path
--
-- Problem: The idempotency guard returns early when status='success' WITHOUT
-- checking if the enrollment/subscription was actually created. This means
-- manually-fixed payments (set to 'success' via SQL) or re-runs of the RPC
-- can never create the missing enrollment.
--
-- Fix: When payment is already 'success', verify the enrollment/subscription
-- exists and create it if missing.

CREATE OR REPLACE FUNCTION complete_keepz_payment(p_keepz_order_id UUID, p_callback_payload JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_payment keepz_payments%ROWTYPE;
  v_course_id UUID;
  v_bundle_course RECORD;
  v_ref_exists BOOLEAN;
BEGIN
  -- Lock the payment row
  SELECT * INTO v_payment FROM keepz_payments
    WHERE keepz_order_id = p_keepz_order_id
    FOR UPDATE;

  IF NOT FOUND THEN
    PERFORM log_payment_event(NULL, p_keepz_order_id, NULL, 'rpc_payment_not_found',
      jsonb_build_object('keepz_order_id', p_keepz_order_id));
    RETURN jsonb_build_object('success', false, 'error', 'Payment not found');
  END IF;

  -- Idempotency: already completed — but verify enrollment exists
  IF v_payment.status = 'success' THEN
    PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'rpc_already_completed',
      jsonb_build_object('payment_type', v_payment.payment_type, 'checking_enrollment', true));

    -- Recovery: ensure enrollment/subscription actually exists
    IF v_payment.payment_type = 'course_enrollment' THEN
      SELECT course_id INTO v_course_id FROM enrollment_requests WHERE id = v_payment.reference_id;
      IF v_course_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM enrollments WHERE user_id = v_payment.user_id AND course_id = v_course_id AND approved_at IS NOT NULL
      ) THEN
        -- Enrollment missing — create it
        UPDATE enrollment_requests SET status = 'approved', reviewed_at = NOW()
          WHERE id = v_payment.reference_id AND status != 'approved';
        INSERT INTO enrollments (user_id, course_id, approved_at)
          VALUES (v_payment.user_id, v_course_id, NOW())
          ON CONFLICT (user_id, course_id) DO UPDATE SET approved_at = NOW();
        PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'enrollment_recovered',
          jsonb_build_object('course_id', v_course_id));
      END IF;

    ELSIF v_payment.payment_type = 'bundle_enrollment' THEN
      IF NOT EXISTS (
        SELECT 1 FROM bundle_enrollments be
        JOIN bundle_enrollment_requests ber ON ber.bundle_id = be.bundle_id
        WHERE ber.id = v_payment.reference_id AND be.user_id = v_payment.user_id
      ) THEN
        -- Bundle enrollment missing — create it
        UPDATE bundle_enrollment_requests SET status = 'approved', reviewed_at = TIMEZONE('utc', NOW())
          WHERE id = v_payment.reference_id AND status != 'approved';
        INSERT INTO bundle_enrollments (user_id, bundle_id)
          SELECT v_payment.user_id, bundle_id FROM bundle_enrollment_requests WHERE id = v_payment.reference_id
          ON CONFLICT (user_id, bundle_id) DO NOTHING;
        -- Create individual course enrollments
        FOR v_bundle_course IN
          SELECT cbi.course_id FROM course_bundle_items cbi
          JOIN bundle_enrollment_requests ber ON ber.bundle_id = cbi.bundle_id
          WHERE ber.id = v_payment.reference_id
        LOOP
          INSERT INTO enrollments (user_id, course_id, approved_at)
            VALUES (v_payment.user_id, v_bundle_course.course_id, NOW())
            ON CONFLICT (user_id, course_id) DO UPDATE SET approved_at = NOW();
        END LOOP;
        PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'bundle_enrollment_recovered',
          jsonb_build_object('reference_id', v_payment.reference_id));
      END IF;

    ELSIF v_payment.payment_type = 'project_subscription' THEN
      IF NOT EXISTS (
        SELECT 1 FROM project_subscriptions
        WHERE id = v_payment.reference_id AND status = 'active'
      ) THEN
        -- Subscription not active — activate it
        UPDATE project_subscriptions SET
          status = 'active', starts_at = NOW(), expires_at = NOW() + INTERVAL '1 month', approved_at = NOW()
          WHERE id = v_payment.reference_id AND status != 'active';
        UPDATE profiles SET
          project_access_expires_at = GREATEST(COALESCE(project_access_expires_at, NOW()), NOW()) + INTERVAL '1 month'
          WHERE id = v_payment.user_id;
        PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'subscription_recovered',
          jsonb_build_object('reference_id', v_payment.reference_id));
      END IF;
    END IF;

    RETURN jsonb_build_object('success', true, 'already_completed', true);
  END IF;

  -- Update payment to success (always — the money was taken by Keepz)
  UPDATE keepz_payments SET
    status = 'success',
    callback_payload = p_callback_payload,
    paid_at = NOW(),
    updated_at = NOW()
  WHERE id = v_payment.id;

  -- Log payment success
  PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'payment_completed',
    jsonb_build_object('payment_type', v_payment.payment_type, 'amount', v_payment.amount));

  -- Process based on payment type
  IF v_payment.payment_type = 'course_enrollment' THEN
    -- Check if enrollment request still exists
    SELECT EXISTS(SELECT 1 FROM enrollment_requests WHERE id = v_payment.reference_id) INTO v_ref_exists;

    IF NOT v_ref_exists THEN
      PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'missing_enrollment_request',
        jsonb_build_object('reference_id', v_payment.reference_id));
      RETURN jsonb_build_object('success', true, 'warning', 'Enrollment request not found — payment recorded but enrollment needs manual creation');
    END IF;

    -- Inline approval: update enrollment request
    UPDATE enrollment_requests SET status = 'approved', reviewed_at = NOW()
      WHERE id = v_payment.reference_id;

    -- Get course_id for enrollment
    SELECT course_id INTO v_course_id FROM enrollment_requests WHERE id = v_payment.reference_id;

    IF v_course_id IS NULL THEN
      PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'null_course_id',
        jsonb_build_object('reference_id', v_payment.reference_id));
      RETURN jsonb_build_object('success', true, 'warning', 'Course ID not found in enrollment request');
    END IF;

    -- Create enrollment (lifetime)
    INSERT INTO enrollments (user_id, course_id, approved_at)
      VALUES (v_payment.user_id, v_course_id, NOW())
      ON CONFLICT (user_id, course_id) DO UPDATE SET approved_at = NOW();

    -- Grant 1-month project access on first enrollment
    IF NOT EXISTS (
      SELECT 1 FROM enrollments
      WHERE user_id = v_payment.user_id
      AND course_id != v_course_id
      AND approved_at IS NOT NULL
    ) THEN
      UPDATE profiles
        SET project_access_expires_at = NOW() + INTERVAL '1 month'
        WHERE id = v_payment.user_id
        AND (project_access_expires_at IS NULL OR project_access_expires_at < NOW());
    END IF;

    PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'enrollment_granted',
      jsonb_build_object('course_id', v_course_id));

  ELSIF v_payment.payment_type = 'bundle_enrollment' THEN
    -- Check if bundle enrollment request still exists
    SELECT EXISTS(SELECT 1 FROM bundle_enrollment_requests WHERE id = v_payment.reference_id) INTO v_ref_exists;

    IF NOT v_ref_exists THEN
      PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'missing_bundle_enrollment_request',
        jsonb_build_object('reference_id', v_payment.reference_id));
      RETURN jsonb_build_object('success', true, 'warning', 'Bundle enrollment request not found');
    END IF;

    -- Approve bundle enrollment request
    UPDATE bundle_enrollment_requests SET
      status = 'approved',
      reviewed_at = TIMEZONE('utc', NOW())
    WHERE id = v_payment.reference_id;

    -- Create bundle enrollment
    INSERT INTO bundle_enrollments (user_id, bundle_id)
      SELECT v_payment.user_id, bundle_id
      FROM bundle_enrollment_requests
      WHERE id = v_payment.reference_id
    ON CONFLICT (user_id, bundle_id) DO NOTHING;

    -- Create individual course enrollments for all courses in the bundle
    FOR v_bundle_course IN
      SELECT cbi.course_id
      FROM course_bundle_items cbi
      JOIN bundle_enrollment_requests ber ON ber.bundle_id = cbi.bundle_id
      WHERE ber.id = v_payment.reference_id
    LOOP
      INSERT INTO enrollments (user_id, course_id, approved_at)
        VALUES (v_payment.user_id, v_bundle_course.course_id, NOW())
        ON CONFLICT (user_id, course_id) DO UPDATE SET approved_at = NOW();
    END LOOP;

    -- Grant 1-month project access on first enrollment
    IF NOT EXISTS (
      SELECT 1 FROM enrollments
      WHERE user_id = v_payment.user_id
      AND approved_at IS NOT NULL
      AND approved_at < NOW() - INTERVAL '1 second'
    ) THEN
      UPDATE profiles
        SET project_access_expires_at = NOW() + INTERVAL '1 month'
        WHERE id = v_payment.user_id
        AND (project_access_expires_at IS NULL OR project_access_expires_at < NOW());
    END IF;

    PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'bundle_enrollment_granted',
      jsonb_build_object('reference_id', v_payment.reference_id));

  ELSIF v_payment.payment_type = 'project_subscription' THEN
    -- Check if project subscription still exists
    SELECT EXISTS(SELECT 1 FROM project_subscriptions WHERE id = v_payment.reference_id) INTO v_ref_exists;

    IF NOT v_ref_exists THEN
      PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'missing_project_subscription',
        jsonb_build_object('reference_id', v_payment.reference_id));
      RETURN jsonb_build_object('success', true, 'warning', 'Project subscription not found');
    END IF;

    -- Inline approval: activate subscription
    UPDATE project_subscriptions SET
      status = 'active',
      starts_at = NOW(),
      expires_at = NOW() + INTERVAL '1 month',
      approved_at = NOW()
    WHERE id = v_payment.reference_id;

    -- Update profile project access
    UPDATE profiles SET
      project_access_expires_at = GREATEST(COALESCE(project_access_expires_at, NOW()), NOW()) + INTERVAL '1 month'
    WHERE id = v_payment.user_id;

    PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'subscription_activated',
      jsonb_build_object('reference_id', v_payment.reference_id));
  END IF;

  RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  -- Log the error but still try to keep payment as success (money was taken)
  PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'rpc_error',
    jsonb_build_object('error', SQLERRM, 'payment_type', v_payment.payment_type));
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
