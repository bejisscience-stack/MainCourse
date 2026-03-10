-- Migration 111: Keepz payment integration
-- - keepz_payments table with RLS
-- - payment_method columns on enrollment_requests & project_subscriptions
-- - complete_keepz_payment RPC (SECURITY DEFINER)

-- ---------------------------------------------------------------------------
-- a) keepz_payments table
-- ---------------------------------------------------------------------------

CREATE TABLE keepz_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  payment_type TEXT NOT NULL CHECK (payment_type IN ('course_enrollment', 'project_subscription')),
  reference_id UUID NOT NULL,
  keepz_order_id UUID UNIQUE,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GEL',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','created','success','failed','expired')),
  checkout_url TEXT,
  callback_payload JSONB,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_keepz_payments_user_id ON keepz_payments(user_id);
CREATE INDEX idx_keepz_payments_keepz_order_id ON keepz_payments(keepz_order_id);
CREATE INDEX idx_keepz_payments_status ON keepz_payments(status);

-- Prevent duplicate active payments for the same item
CREATE UNIQUE INDEX idx_keepz_payments_active
  ON keepz_payments(payment_type, reference_id)
  WHERE status IN ('pending', 'created');

-- RLS
ALTER TABLE keepz_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payments"
  ON keepz_payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own payments"
  ON keepz_payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE keepz_payments;


-- ---------------------------------------------------------------------------
-- b) Schema changes: payment_method columns
-- ---------------------------------------------------------------------------

ALTER TABLE enrollment_requests ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'bank_transfer';
ALTER TABLE project_subscriptions ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'bank_transfer';
ALTER TABLE project_subscriptions ALTER COLUMN payment_screenshot DROP NOT NULL;


-- ---------------------------------------------------------------------------
-- c) complete_keepz_payment RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION complete_keepz_payment(p_keepz_order_id UUID, p_callback_payload JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_payment keepz_payments%ROWTYPE;
  v_course_id UUID;
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
