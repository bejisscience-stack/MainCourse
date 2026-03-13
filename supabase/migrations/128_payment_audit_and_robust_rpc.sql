-- Migration 128: Payment audit logging + robust complete_keepz_payment RPC
-- - payment_audit_log table for tracking all payment events
-- - Updated RPC that handles missing enrollment_requests gracefully
-- - Cleans up orphaned "created" payments older than 24 hours

-- ---------------------------------------------------------------------------
-- a) payment_audit_log table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS payment_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keepz_payment_id UUID REFERENCES keepz_payments(id),
  keepz_order_id UUID,
  user_id UUID REFERENCES auth.users(id),
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_audit_log_payment_id ON payment_audit_log(keepz_payment_id);
CREATE INDEX idx_payment_audit_log_user_id ON payment_audit_log(user_id);
CREATE INDEX idx_payment_audit_log_event_type ON payment_audit_log(event_type);
CREATE INDEX idx_payment_audit_log_created_at ON payment_audit_log(created_at DESC);

-- RLS: admins can read, service role can write
ALTER TABLE payment_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit log"
  ON payment_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- b) Helper: log_payment_event (SECURITY DEFINER for service-role writes)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION log_payment_event(
  p_keepz_payment_id UUID,
  p_keepz_order_id UUID,
  p_user_id UUID,
  p_event_type TEXT,
  p_event_data JSONB DEFAULT '{}'
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO payment_audit_log (keepz_payment_id, keepz_order_id, user_id, event_type, event_data)
  VALUES (p_keepz_payment_id, p_keepz_order_id, p_user_id, p_event_type, p_event_data);
EXCEPTION WHEN OTHERS THEN
  -- Never let audit logging break the main flow
  RAISE WARNING 'Failed to log payment event: %', SQLERRM;
END;
$$;

-- ---------------------------------------------------------------------------
-- c) Updated complete_keepz_payment RPC — handles missing references
-- ---------------------------------------------------------------------------

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

  -- Idempotency: already completed
  IF v_payment.status = 'success' THEN
    PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'rpc_already_completed', '{}');
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

-- ---------------------------------------------------------------------------
-- d) Expire abandoned payments older than 24 hours
-- ---------------------------------------------------------------------------

UPDATE keepz_payments
SET status = 'expired', updated_at = NOW()
WHERE status IN ('pending', 'created')
AND created_at < NOW() - INTERVAL '24 hours';
