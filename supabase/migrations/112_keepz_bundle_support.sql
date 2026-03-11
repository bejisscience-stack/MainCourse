-- Migration 112: Keepz bundle enrollment support
-- - Extend keepz_payments.payment_type to include 'bundle_enrollment'
-- - Add bundle_enrollment case to complete_keepz_payment RPC
-- - Add payment_method column to bundle_enrollment_requests

-- ---------------------------------------------------------------------------
-- a) Extend keepz_payments payment_type CHECK constraint
-- ---------------------------------------------------------------------------

ALTER TABLE keepz_payments DROP CONSTRAINT IF EXISTS keepz_payments_payment_type_check;
ALTER TABLE keepz_payments ADD CONSTRAINT keepz_payments_payment_type_check
  CHECK (payment_type IN ('course_enrollment', 'project_subscription', 'bundle_enrollment'));

-- ---------------------------------------------------------------------------
-- b) Add payment_method column to bundle_enrollment_requests
-- ---------------------------------------------------------------------------

ALTER TABLE bundle_enrollment_requests ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'bank_transfer';

-- ---------------------------------------------------------------------------
-- c) Update complete_keepz_payment RPC to handle bundle_enrollment
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION complete_keepz_payment(p_keepz_order_id UUID, p_callback_payload JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_payment keepz_payments%ROWTYPE;
  v_course_id UUID;
  v_bundle_course RECORD;
BEGIN
  -- Lock the payment row
  SELECT * INTO v_payment FROM keepz_payments
    WHERE keepz_order_id = p_keepz_order_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment not found');
  END IF;

  -- Idempotency: already completed
  IF v_payment.status = 'success' THEN
    RETURN jsonb_build_object('success', true, 'already_completed', true);
  END IF;

  -- Update payment to success
  UPDATE keepz_payments SET
    status = 'success',
    callback_payload = p_callback_payload,
    paid_at = NOW(),
    updated_at = NOW()
  WHERE id = v_payment.id;

  -- Process based on payment type
  IF v_payment.payment_type = 'course_enrollment' THEN
    -- Inline approval: update enrollment request
    UPDATE enrollment_requests SET status = 'approved', reviewed_at = NOW()
      WHERE id = v_payment.reference_id;

    -- Get course_id for enrollment
    SELECT course_id INTO v_course_id FROM enrollment_requests WHERE id = v_payment.reference_id;

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

  ELSIF v_payment.payment_type = 'bundle_enrollment' THEN
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

  ELSIF v_payment.payment_type = 'project_subscription' THEN
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
  END IF;

  RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
