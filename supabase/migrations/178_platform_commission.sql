-- Migration 178: Add platform commission (3%) to course/bundle pricing
--
-- Business logic:
--   Lecturer sets base price (e.g., ₾100).
--   Student pays base_price × 1.03 (e.g., ₾103). The 3% is platform commission.
--   Keepz fee is calculated on the total amount charged (₾103).
--   Lecturer receives: base_price - keepz_fee - referral_commission
--   Platform commission is recorded per payment for accounting.
--
-- Changes:
--   1. Add platform_commission column to keepz_payments
--   2. Redefine complete_keepz_payment() with platform commission tracking
--   3. Redefine approve_enrollment_request() with platform commission deduction
--   4. Redefine approve_bundle_enrollment_request() with platform commission deduction

-- ============================================================================
-- 1. Add platform_commission column to keepz_payments
-- ============================================================================

ALTER TABLE keepz_payments
  ADD COLUMN IF NOT EXISTS platform_commission NUMERIC(10,2) DEFAULT 0;

COMMENT ON COLUMN keepz_payments.platform_commission IS
  'Platform commission amount (3% of base price). Recorded on payment success.';

-- ============================================================================
-- 2. Redefine complete_keepz_payment() — add platform commission tracking
--    Source: migration 168 (the latest version)
-- ============================================================================

CREATE OR REPLACE FUNCTION complete_keepz_payment(p_keepz_order_id UUID, p_callback_payload JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_payment keepz_payments%ROWTYPE;
  v_course_id UUID;
  v_bundle_course RECORD;
  v_ref_exists BOOLEAN;
  -- Balance credit variables
  v_course courses%ROWTYPE;
  v_referral referrals%ROWTYPE;
  v_bundle course_bundles%ROWTYPE;
  v_commission DECIMAL;
  v_referrer_amount DECIMAL;
  v_lecturer_amount DECIMAL;
  v_balance_already_credited BOOLEAN;
  -- Keepz commission
  v_keepz_fee DECIMAL;
  -- Platform commission
  v_platform_commission DECIMAL;
  -- Double-credit guard
  v_rows_affected INTEGER;
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

  -- Calculate Keepz processing fee based on payment method (on TOTAL amount charged)
  v_keepz_fee := CASE v_payment.payment_method_type
    WHEN 'card' THEN v_payment.amount * 0.025
    WHEN 'bank' THEN CASE WHEN v_payment.amount <= 10000 THEN v_payment.amount * 0.01
                      ELSE LEAST(v_payment.amount * 0.006, 100) END
    WHEN 'split' THEN v_payment.amount * 0.03
    ELSE v_payment.amount * 0.025
  END;
  v_keepz_fee := ROUND(v_keepz_fee, 2);

  -- Idempotency: already completed — but verify enrollment + balance exists
  IF v_payment.status = 'success' THEN
    PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'rpc_already_completed',
      jsonb_build_object('payment_type', v_payment.payment_type, 'checking_enrollment', true));

    -- Recovery: ensure enrollment/subscription actually exists
    IF v_payment.payment_type = 'course_enrollment' THEN
      SELECT course_id INTO v_course_id FROM enrollment_requests WHERE id = v_payment.reference_id;
      IF v_course_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM enrollments WHERE user_id = v_payment.user_id AND course_id = v_course_id AND approved_at IS NOT NULL
      ) THEN
        UPDATE enrollment_requests SET status = 'approved', reviewed_at = NOW()
          WHERE id = v_payment.reference_id AND status != 'approved';
        INSERT INTO enrollments (user_id, course_id, approved_at)
          VALUES (v_payment.user_id, v_course_id, NOW())
          ON CONFLICT (user_id, course_id) DO UPDATE SET approved_at = NOW();
        PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'enrollment_recovered',
          jsonb_build_object('course_id', v_course_id));
      END IF;

      -- Recovery: credit balance if not already credited
      IF v_course_id IS NOT NULL THEN
        SELECT NOT EXISTS (
          SELECT 1 FROM balance_transactions
          WHERE reference_id = v_payment.reference_id
          AND source IN ('course_purchase', 'referral_commission')
        ) INTO v_balance_already_credited;

        IF v_balance_already_credited THEN
          SELECT * INTO v_course FROM courses WHERE id = v_course_id;
          IF FOUND AND v_course.price > 0 THEN
            -- Platform commission = 3% of base price
            v_platform_commission := ROUND(v_course.price * 0.03, 2);

            SELECT r.* INTO v_referral FROM referrals r
              WHERE r.enrollment_request_id = v_payment.reference_id LIMIT 1;

            IF FOUND AND v_course.referral_commission_percentage > 0 THEN
              v_commission := (v_course.referral_commission_percentage::DECIMAL / 100) * v_course.price;
              v_referrer_amount := v_commission;
              v_lecturer_amount := GREATEST(v_course.price - v_keepz_fee - v_platform_commission - v_commission, 0);

              PERFORM credit_user_balance(v_referral.referrer_id, v_referrer_amount, 'referral_commission', v_payment.reference_id, 'enrollment_request', 'Referral commission (Keepz payment recovery)');
              PERFORM credit_user_balance(v_course.lecturer_id, v_lecturer_amount, 'course_purchase', v_payment.reference_id, 'enrollment_request', 'Course sale (Keepz payment recovery)');
            ELSE
              v_lecturer_amount := GREATEST(v_course.price - v_keepz_fee - v_platform_commission, 0);
              PERFORM credit_user_balance(v_course.lecturer_id, v_lecturer_amount, 'course_purchase', v_payment.reference_id, 'enrollment_request', 'Course sale (Keepz payment recovery)');
            END IF;

            -- Update platform commission on the payment record
            UPDATE keepz_payments SET platform_commission = v_platform_commission WHERE id = v_payment.id;

            PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'balance_recovered',
              jsonb_build_object('course_id', v_course_id, 'amount', v_course.price, 'keepz_fee', v_keepz_fee, 'platform_commission', v_platform_commission));
          END IF;
        END IF;
      END IF;

    ELSIF v_payment.payment_type = 'bundle_enrollment' THEN
      IF NOT EXISTS (
        SELECT 1 FROM bundle_enrollments be
        JOIN bundle_enrollment_requests ber ON ber.bundle_id = be.bundle_id
        WHERE ber.id = v_payment.reference_id AND be.user_id = v_payment.user_id
      ) THEN
        UPDATE bundle_enrollment_requests SET status = 'approved', reviewed_at = TIMEZONE('utc', NOW())
          WHERE id = v_payment.reference_id AND status != 'approved';
        INSERT INTO bundle_enrollments (user_id, bundle_id)
          SELECT v_payment.user_id, bundle_id FROM bundle_enrollment_requests WHERE id = v_payment.reference_id
          ON CONFLICT (user_id, bundle_id) DO NOTHING;
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

      -- Recovery: credit bundle balance if not already credited
      SELECT NOT EXISTS (
        SELECT 1 FROM balance_transactions
        WHERE reference_id = v_payment.reference_id
        AND source = 'course_purchase'
      ) INTO v_balance_already_credited;

      IF v_balance_already_credited THEN
        SELECT cb.* INTO v_bundle FROM course_bundles cb
          JOIN bundle_enrollment_requests ber ON ber.bundle_id = cb.id
          WHERE ber.id = v_payment.reference_id;

        IF FOUND AND v_bundle.price > 0 THEN
          v_platform_commission := ROUND(v_bundle.price * 0.03, 2);
          v_lecturer_amount := GREATEST(v_bundle.price - v_keepz_fee - v_platform_commission, 0);
          PERFORM credit_user_balance(v_bundle.lecturer_id, v_lecturer_amount, 'course_purchase', v_payment.reference_id, 'bundle_enrollment_request', 'Bundle sale (Keepz payment recovery)');

          UPDATE keepz_payments SET platform_commission = v_platform_commission WHERE id = v_payment.id;

          PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'bundle_balance_recovered',
            jsonb_build_object('bundle_id', v_bundle.id, 'amount', v_bundle.price, 'keepz_fee', v_keepz_fee, 'platform_commission', v_platform_commission));
        END IF;
      END IF;

    ELSIF v_payment.payment_type = 'project_subscription' THEN
      IF NOT EXISTS (
        SELECT 1 FROM project_subscriptions
        WHERE id = v_payment.reference_id AND status = 'active'
      ) THEN
        UPDATE project_subscriptions SET
          status = 'active', starts_at = NOW(), expires_at = NOW() + INTERVAL '1 month', approved_at = NOW()
          WHERE id = v_payment.reference_id AND status != 'active';
        UPDATE profiles SET
          project_access_expires_at = GREATEST(COALESCE(project_access_expires_at, NOW()), NOW()) + INTERVAL '1 month'
          WHERE id = v_payment.user_id;
        PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'subscription_recovered',
          jsonb_build_object('reference_id', v_payment.reference_id));
      END IF;

    ELSIF v_payment.payment_type = 'project_budget' THEN
      IF NOT EXISTS (
        SELECT 1 FROM projects
        WHERE id = v_payment.reference_id AND status = 'active'
      ) THEN
        UPDATE projects SET status = 'active', updated_at = NOW()
          WHERE id = v_payment.reference_id AND user_id = v_payment.user_id;
        PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'project_budget_recovered',
          jsonb_build_object('project_id', v_payment.reference_id));
      END IF;
    END IF;

    RETURN jsonb_build_object('success', true, 'already_completed', true);
  END IF;

  -- =========================================================================
  -- MAIN PATH: First-time payment completion
  -- =========================================================================

  -- Calculate platform commission based on payment type
  v_platform_commission := 0;
  IF v_payment.payment_type = 'course_enrollment' THEN
    SELECT course_id INTO v_course_id FROM enrollment_requests WHERE id = v_payment.reference_id;
    IF v_course_id IS NOT NULL THEN
      SELECT price INTO v_platform_commission FROM courses WHERE id = v_course_id;
      IF v_platform_commission IS NOT NULL THEN
        v_platform_commission := ROUND(v_platform_commission * 0.03, 2);
      ELSE
        v_platform_commission := 0;
      END IF;
    END IF;
  ELSIF v_payment.payment_type = 'bundle_enrollment' THEN
    SELECT cb.price INTO v_platform_commission FROM course_bundles cb
      JOIN bundle_enrollment_requests ber ON ber.bundle_id = cb.id
      WHERE ber.id = v_payment.reference_id;
    IF v_platform_commission IS NOT NULL THEN
      v_platform_commission := ROUND(v_platform_commission * 0.03, 2);
    ELSE
      v_platform_commission := 0;
    END IF;
  END IF;

  -- Update payment to success (always — the money was taken by Keepz)
  -- This is in the OUTER block (no EXCEPTION handler) so it will NOT be
  -- rolled back if business logic below fails.
  UPDATE keepz_payments SET
    status = 'success',
    callback_payload = p_callback_payload,
    paid_at = NOW(),
    updated_at = NOW(),
    keepz_commission = v_keepz_fee,
    platform_commission = v_platform_commission
  WHERE id = v_payment.id;

  -- Log payment success
  PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'payment_completed',
    jsonb_build_object('payment_type', v_payment.payment_type, 'amount', v_payment.amount, 'keepz_fee', v_keepz_fee, 'platform_commission', v_platform_commission));

  -- =========================================================================
  -- NESTED BLOCK: Business logic with its own exception handler.
  -- If anything here fails, the payment status = 'success' above is preserved.
  -- =========================================================================
  BEGIN
    -- Process based on payment type
    IF v_payment.payment_type = 'course_enrollment' THEN
      SELECT EXISTS(SELECT 1 FROM enrollment_requests WHERE id = v_payment.reference_id) INTO v_ref_exists;

      IF NOT v_ref_exists THEN
        PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'missing_enrollment_request',
          jsonb_build_object('reference_id', v_payment.reference_id));
        RETURN jsonb_build_object('success', true, 'warning', 'Enrollment request not found — payment recorded but enrollment needs manual creation');
      END IF;

      -- SEC-05: Only approve if still pending (prevents double-credit)
      UPDATE enrollment_requests SET status = 'approved', reviewed_at = NOW()
        WHERE id = v_payment.reference_id AND status = 'pending';
      GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
      IF v_rows_affected = 0 THEN
        PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'enrollment_already_approved',
          jsonb_build_object('reference_id', v_payment.reference_id));
        RETURN jsonb_build_object('success', true, 'already_completed', true);
      END IF;

      -- Get course_id for enrollment (already fetched above for platform commission)
      IF v_course_id IS NULL THEN
        SELECT course_id INTO v_course_id FROM enrollment_requests WHERE id = v_payment.reference_id;
      END IF;

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

      -- =====================================================================
      -- BALANCE CREDIT: Deducts Keepz fee + platform commission from lecturer
      -- Lecturer gets: base_price - keepz_fee - platform_commission - referral
      -- =====================================================================
      SELECT * INTO v_course FROM courses WHERE id = v_course_id;

      IF FOUND AND v_course.price > 0 THEN
        SELECT r.* INTO v_referral FROM referrals r
          WHERE r.enrollment_request_id = v_payment.reference_id LIMIT 1;

        IF FOUND AND v_course.referral_commission_percentage > 0 THEN
          -- Referral commission on BASE price
          v_commission := (v_course.referral_commission_percentage::DECIMAL / 100) * v_course.price;
          v_referrer_amount := v_commission;
          v_lecturer_amount := GREATEST(v_course.price - v_keepz_fee - v_platform_commission - v_commission, 0);

          PERFORM credit_user_balance(v_referral.referrer_id, v_referrer_amount, 'referral_commission', v_payment.reference_id, 'enrollment_request', 'Referral commission from Keepz payment');
          PERFORM credit_user_balance(v_course.lecturer_id, v_lecturer_amount, 'course_purchase', v_payment.reference_id, 'enrollment_request', 'Course sale from Keepz payment (after referral, Keepz fee, and platform commission)');

          PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'balance_credited_with_referral',
            jsonb_build_object('course_id', v_course_id, 'lecturer_amount', v_lecturer_amount, 'referrer_amount', v_referrer_amount, 'referrer_id', v_referral.referrer_id, 'keepz_fee', v_keepz_fee, 'platform_commission', v_platform_commission));
        ELSE
          -- No referral — lecturer gets base price minus fees
          v_lecturer_amount := GREATEST(v_course.price - v_keepz_fee - v_platform_commission, 0);
          PERFORM credit_user_balance(v_course.lecturer_id, v_lecturer_amount, 'course_purchase', v_payment.reference_id, 'enrollment_request', 'Course sale from Keepz payment (after Keepz fee and platform commission)');

          PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'balance_credited',
            jsonb_build_object('course_id', v_course_id, 'amount', v_lecturer_amount, 'lecturer_id', v_course.lecturer_id, 'keepz_fee', v_keepz_fee, 'platform_commission', v_platform_commission));
        END IF;
      END IF;

      PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'enrollment_granted',
        jsonb_build_object('course_id', v_course_id));

    ELSIF v_payment.payment_type = 'bundle_enrollment' THEN
      SELECT EXISTS(SELECT 1 FROM bundle_enrollment_requests WHERE id = v_payment.reference_id) INTO v_ref_exists;

      IF NOT v_ref_exists THEN
        PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'missing_bundle_enrollment_request',
          jsonb_build_object('reference_id', v_payment.reference_id));
        RETURN jsonb_build_object('success', true, 'warning', 'Bundle enrollment request not found');
      END IF;

      -- SEC-05: Only approve if still pending
      UPDATE bundle_enrollment_requests SET
        status = 'approved',
        reviewed_at = TIMEZONE('utc', NOW())
      WHERE id = v_payment.reference_id AND status = 'pending';
      GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
      IF v_rows_affected = 0 THEN
        PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'bundle_already_approved',
          jsonb_build_object('reference_id', v_payment.reference_id));
        RETURN jsonb_build_object('success', true, 'already_completed', true);
      END IF;

      -- Create bundle enrollment
      INSERT INTO bundle_enrollments (user_id, bundle_id)
        SELECT v_payment.user_id, bundle_id
        FROM bundle_enrollment_requests
        WHERE id = v_payment.reference_id
      ON CONFLICT (user_id, bundle_id) DO NOTHING;

      -- Create individual course enrollments
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

      -- =====================================================================
      -- BALANCE CREDIT: credit lecturer for bundle sale (minus all fees)
      -- =====================================================================
      SELECT cb.* INTO v_bundle FROM course_bundles cb
        JOIN bundle_enrollment_requests ber ON ber.bundle_id = cb.id
        WHERE ber.id = v_payment.reference_id;

      IF FOUND AND v_bundle.price > 0 THEN
        v_lecturer_amount := GREATEST(v_bundle.price - v_keepz_fee - v_platform_commission, 0);
        PERFORM credit_user_balance(v_bundle.lecturer_id, v_lecturer_amount, 'course_purchase', v_payment.reference_id, 'bundle_enrollment_request', 'Bundle sale from Keepz payment (after Keepz fee and platform commission)');

        PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'bundle_balance_credited',
          jsonb_build_object('bundle_id', v_bundle.id, 'amount', v_lecturer_amount, 'lecturer_id', v_bundle.lecturer_id, 'keepz_fee', v_keepz_fee, 'platform_commission', v_platform_commission));
      END IF;

      PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'bundle_enrollment_granted',
        jsonb_build_object('reference_id', v_payment.reference_id));

    ELSIF v_payment.payment_type = 'project_subscription' THEN
      SELECT EXISTS(SELECT 1 FROM project_subscriptions WHERE id = v_payment.reference_id) INTO v_ref_exists;

      IF NOT v_ref_exists THEN
        PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'missing_project_subscription',
          jsonb_build_object('reference_id', v_payment.reference_id));
        RETURN jsonb_build_object('success', true, 'warning', 'Project subscription not found');
      END IF;

      UPDATE project_subscriptions SET
        status = 'active',
        starts_at = NOW(),
        expires_at = NOW() + INTERVAL '1 month',
        approved_at = NOW()
      WHERE id = v_payment.reference_id AND status = 'pending';
      GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
      IF v_rows_affected = 0 THEN
        PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'subscription_already_activated',
          jsonb_build_object('reference_id', v_payment.reference_id));
        RETURN jsonb_build_object('success', true, 'already_completed', true);
      END IF;

      UPDATE profiles SET
        project_access_expires_at = GREATEST(COALESCE(project_access_expires_at, NOW()), NOW()) + INTERVAL '1 month'
      WHERE id = v_payment.user_id;

      PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'subscription_activated',
        jsonb_build_object('reference_id', v_payment.reference_id));

    ELSIF v_payment.payment_type = 'project_budget' THEN
      SELECT EXISTS(SELECT 1 FROM projects WHERE id = v_payment.reference_id) INTO v_ref_exists;

      IF NOT v_ref_exists THEN
        PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'missing_project',
          jsonb_build_object('reference_id', v_payment.reference_id));
        RETURN jsonb_build_object('success', true, 'warning', 'Project not found — payment recorded but project needs manual activation');
      END IF;

      UPDATE projects SET status = 'active', updated_at = NOW()
        WHERE id = v_payment.reference_id AND user_id = v_payment.user_id;

      PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'project_budget_paid',
        jsonb_build_object('project_id', v_payment.reference_id));
    END IF;

    RETURN jsonb_build_object('success', true);

  EXCEPTION WHEN OTHERS THEN
    -- Business logic failed but payment status = 'success' is PRESERVED
    PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'rpc_business_logic_error',
      jsonb_build_object('error', SQLERRM, 'payment_type', v_payment.payment_type, 'payment_recorded', true));
    RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'payment_recorded', true);
  END;

END;
$$;

-- ============================================================================
-- 3. Redefine approve_enrollment_request() — deduct platform commission
--    Source: migration 166 lines 25-86
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
  v_platform_commission DECIMAL;
BEGIN
  IF NOT check_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_request FROM enrollment_requests WHERE id = request_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found or not pending'; END IF;

  SELECT * INTO v_course FROM courses WHERE id = v_request.course_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Course not found'; END IF;

  -- Platform commission: 3% of base price
  v_platform_commission := ROUND(v_course.price * 0.03, 2);

  -- Calculate and distribute commission
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
-- 4. Redefine approve_bundle_enrollment_request() — deduct platform commission
--    Source: migration 166 lines 93-141
-- ============================================================================

CREATE OR REPLACE FUNCTION approve_bundle_enrollment_request(request_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_request bundle_enrollment_requests%ROWTYPE;
  v_bundle course_bundles%ROWTYPE;
  v_course_id UUID;
  v_platform_commission DECIMAL;
  v_lecturer_amount DECIMAL;
BEGIN
  IF NOT check_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_request FROM bundle_enrollment_requests WHERE id = request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

  SELECT * INTO v_bundle FROM course_bundles WHERE id = v_request.bundle_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bundle not found'; END IF;

  -- Platform commission: 3% of base bundle price
  v_platform_commission := ROUND(v_bundle.price * 0.03, 2);
  v_lecturer_amount := GREATEST(v_bundle.price - v_platform_commission, 0);

  -- Credit lecturer balance (minus platform commission)
  PERFORM credit_user_balance(v_bundle.lecturer_id, v_lecturer_amount, 'course_purchase', request_id::TEXT);

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
    'Bundle Enrollment Approved',
    'ბანდელის ჩარიცხვა დამტკიცდა',
    'You have been enrolled in ' || v_bundle.title,
    'თქვენ ჩაირიცხეთ ' || v_bundle.title || '-ში',
    jsonb_build_object('bundle_id', v_request.bundle_id, 'request_id', request_id),
    auth.uid()
  );
END;
$$;
