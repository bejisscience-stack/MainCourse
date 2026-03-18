-- Migration 166: Remove first-enrollment global project access grant
--
-- Bug: When a user enrolls in a course (via admin approval or Keepz payment),
-- the first-enrollment check grants global project_access_expires_at = NOW() + 1 month.
-- This makes has_project_access() return TRUE, giving access to ALL projects
-- instead of only the enrolled course's projects.
--
-- Fix: Remove the first-enrollment project access grant from 3 functions:
--   1. approve_enrollment_request()        (latest: mig 133)
--   2. approve_bundle_enrollment_request()  (latest: mig 133)
--   3. complete_keepz_payment()             (latest: mig 161)
--
-- Project access should ONLY come from:
--   a) Free 1-month on registration (profiles.project_access_expires_at set in handle_new_user)
--   b) Paid project subscription (project_subscriptions table)
--
-- Course enrollment grants course-specific project access via RLS policy:
--   "Users can view projects in enrolled courses" (mig 050, modified mig 138)

-- ============================================================================
-- 1. Recreate approve_enrollment_request() — remove first-enrollment grant
--    Source: migration 133 lines 357-430, minus lines 366 + 403-416
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

  SELECT * INTO v_request FROM enrollment_requests WHERE id = request_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found or not pending'; END IF;

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
    PERFORM credit_user_balance(v_course.lecturer_id, v_lecturer_amount, 'course_purchase', request_id::TEXT);
  ELSE
    PERFORM credit_user_balance(v_course.lecturer_id, v_course.price, 'course_purchase', request_id::TEXT);
  END IF;

  -- Update enrollment request status
  UPDATE enrollment_requests
    SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = NOW()
    WHERE id = request_id;

  -- Insert or update enrollment (lifetime: no expires_at)
  INSERT INTO enrollments (user_id, course_id, approved_at)
    VALUES (v_request.user_id, v_request.course_id, NOW())
    ON CONFLICT (user_id, course_id) DO UPDATE SET approved_at = NOW();

  -- NOTE: First-enrollment global project access grant REMOVED (mig 166).
  -- Course enrollment now grants course-specific access only, via RLS policy
  -- "Users can view projects in enrolled courses".

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
-- 2. Recreate approve_bundle_enrollment_request() — remove first-enrollment grant
--    Source: migration 133 lines 436-495, minus lines 442 + 469-481
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
  PERFORM credit_user_balance(v_bundle.lecturer_id, v_bundle.price, 'course_purchase', request_id::TEXT);

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

  -- NOTE: First-enrollment global project access grant REMOVED (mig 166).
  -- Course enrollment now grants course-specific access only, via RLS policy
  -- "Users can view projects in enrolled courses".

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

-- ============================================================================
-- 3. Recreate complete_keepz_payment() — remove first-enrollment grants
--    Source: migration 161 lines 8-411, minus lines 233-244 and 322-333
-- ============================================================================

CREATE OR REPLACE FUNCTION complete_keepz_payment(p_keepz_order_id UUID, p_callback_payload JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_payment keepz_payments%ROWTYPE;
  v_course_id UUID;
  v_bundle_course RECORD;
  v_ref_exists BOOLEAN;
  -- Balance credit variables (matching approve_enrollment_request pattern)
  v_course courses%ROWTYPE;
  v_referral referrals%ROWTYPE;
  v_bundle course_bundles%ROWTYPE;
  v_commission DECIMAL;
  v_referrer_amount DECIMAL;
  v_lecturer_amount DECIMAL;
  v_balance_already_credited BOOLEAN;
  -- Keepz commission
  v_keepz_fee DECIMAL;
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

  -- Calculate Keepz processing fee based on payment method
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
        -- Enrollment missing — create it
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
            -- Check for referral
            SELECT r.* INTO v_referral FROM referrals r
              WHERE r.enrollment_request_id = v_payment.reference_id LIMIT 1;

            IF FOUND AND v_course.referral_commission_percentage > 0 THEN
              v_commission := (v_course.referral_commission_percentage::DECIMAL / 100) * v_course.price;
              v_referrer_amount := v_commission;
              v_lecturer_amount := GREATEST(v_course.price - v_keepz_fee - v_commission, 0);

              PERFORM credit_user_balance(v_referral.referrer_id, v_referrer_amount, 'referral_commission', v_payment.reference_id, 'enrollment_request', 'Referral commission (Keepz payment recovery)');
              PERFORM credit_user_balance(v_course.lecturer_id, v_lecturer_amount, 'course_purchase', v_payment.reference_id, 'enrollment_request', 'Course sale (Keepz payment recovery)');
            ELSE
              v_lecturer_amount := GREATEST(v_course.price - v_keepz_fee, 0);
              PERFORM credit_user_balance(v_course.lecturer_id, v_lecturer_amount, 'course_purchase', v_payment.reference_id, 'enrollment_request', 'Course sale (Keepz payment recovery)');
            END IF;

            PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'balance_recovered',
              jsonb_build_object('course_id', v_course_id, 'amount', v_course.price, 'keepz_fee', v_keepz_fee));
          END IF;
        END IF;
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
          v_lecturer_amount := GREATEST(v_bundle.price - v_keepz_fee, 0);
          PERFORM credit_user_balance(v_bundle.lecturer_id, v_lecturer_amount, 'course_purchase', v_payment.reference_id, 'bundle_enrollment_request', 'Bundle sale (Keepz payment recovery)');
          PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'bundle_balance_recovered',
            jsonb_build_object('bundle_id', v_bundle.id, 'amount', v_bundle.price, 'keepz_fee', v_keepz_fee));
        END IF;
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

    ELSIF v_payment.payment_type = 'project_budget' THEN
      -- Recovery: ensure project is active
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

  -- Update payment to success (always — the money was taken by Keepz)
  UPDATE keepz_payments SET
    status = 'success',
    callback_payload = p_callback_payload,
    paid_at = NOW(),
    updated_at = NOW(),
    keepz_commission = v_keepz_fee
  WHERE id = v_payment.id;

  -- Log payment success
  PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'payment_completed',
    jsonb_build_object('payment_type', v_payment.payment_type, 'amount', v_payment.amount, 'keepz_fee', v_keepz_fee));

  -- Process based on payment type
  IF v_payment.payment_type = 'course_enrollment' THEN
    -- Check if enrollment request still exists
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

    -- NOTE: First-enrollment global project access grant REMOVED (mig 166).
    -- Course enrollment grants course-specific access only, via RLS policy
    -- "Users can view projects in enrolled courses".

    -- =====================================================================
    -- BALANCE CREDIT: matching approve_enrollment_request logic
    -- Deducts Keepz processing fee from lecturer payout
    -- =====================================================================
    SELECT * INTO v_course FROM courses WHERE id = v_course_id;

    IF FOUND AND v_course.price > 0 THEN
      -- Check for referral linked to this enrollment request
      SELECT r.* INTO v_referral FROM referrals r
        WHERE r.enrollment_request_id = v_payment.reference_id LIMIT 1;

      IF FOUND AND v_course.referral_commission_percentage > 0 THEN
        -- Split payment between referrer and lecturer, deducting Keepz fee from lecturer share
        v_commission := (v_course.referral_commission_percentage::DECIMAL / 100) * v_course.price;
        v_referrer_amount := v_commission;
        v_lecturer_amount := GREATEST(v_course.price - v_keepz_fee - v_commission, 0);

        PERFORM credit_user_balance(v_referral.referrer_id, v_referrer_amount, 'referral_commission', v_payment.reference_id, 'enrollment_request', 'Referral commission from Keepz payment');
        PERFORM credit_user_balance(v_course.lecturer_id, v_lecturer_amount, 'course_purchase', v_payment.reference_id, 'enrollment_request', 'Course sale from Keepz payment (after referral commission and Keepz fee)');

        PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'balance_credited_with_referral',
          jsonb_build_object('course_id', v_course_id, 'lecturer_amount', v_lecturer_amount, 'referrer_amount', v_referrer_amount, 'referrer_id', v_referral.referrer_id, 'keepz_fee', v_keepz_fee));
      ELSE
        -- No referral — lecturer gets price minus Keepz fee
        v_lecturer_amount := GREATEST(v_course.price - v_keepz_fee, 0);
        PERFORM credit_user_balance(v_course.lecturer_id, v_lecturer_amount, 'course_purchase', v_payment.reference_id, 'enrollment_request', 'Course sale from Keepz payment (after Keepz fee)');

        PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'balance_credited',
          jsonb_build_object('course_id', v_course_id, 'amount', v_lecturer_amount, 'lecturer_id', v_course.lecturer_id, 'keepz_fee', v_keepz_fee));
      END IF;
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

    -- SEC-05: Only approve if still pending (prevents double-credit)
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

    -- NOTE: First-enrollment global project access grant REMOVED (mig 166).
    -- Course enrollment grants course-specific access only, via RLS policy
    -- "Users can view projects in enrolled courses".

    -- =====================================================================
    -- BALANCE CREDIT: credit lecturer for bundle sale (minus Keepz fee)
    -- =====================================================================
    SELECT cb.* INTO v_bundle FROM course_bundles cb
      JOIN bundle_enrollment_requests ber ON ber.bundle_id = cb.id
      WHERE ber.id = v_payment.reference_id;

    IF FOUND AND v_bundle.price > 0 THEN
      v_lecturer_amount := GREATEST(v_bundle.price - v_keepz_fee, 0);
      PERFORM credit_user_balance(v_bundle.lecturer_id, v_lecturer_amount, 'course_purchase', v_payment.reference_id, 'bundle_enrollment_request', 'Bundle sale from Keepz payment (after Keepz fee)');

      PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'bundle_balance_credited',
        jsonb_build_object('bundle_id', v_bundle.id, 'amount', v_lecturer_amount, 'lecturer_id', v_bundle.lecturer_id, 'keepz_fee', v_keepz_fee));
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

    -- PAY-03: Only activate if still pending (prevents double-activation from duplicate Keepz callbacks)
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

    -- Update profile project access
    UPDATE profiles SET
      project_access_expires_at = GREATEST(COALESCE(project_access_expires_at, NOW()), NOW()) + INTERVAL '1 month'
    WHERE id = v_payment.user_id;

    PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'subscription_activated',
      jsonb_build_object('reference_id', v_payment.reference_id));

  ELSIF v_payment.payment_type = 'project_budget' THEN
    -- Check if project still exists
    SELECT EXISTS(SELECT 1 FROM projects WHERE id = v_payment.reference_id) INTO v_ref_exists;

    IF NOT v_ref_exists THEN
      PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'missing_project',
        jsonb_build_object('reference_id', v_payment.reference_id));
      RETURN jsonb_build_object('success', true, 'warning', 'Project not found — payment recorded but project needs manual activation');
    END IF;

    -- Activate the project (verify ownership for defense-in-depth)
    UPDATE projects SET status = 'active', updated_at = NOW()
      WHERE id = v_payment.reference_id AND user_id = v_payment.user_id;

    PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'project_budget_paid',
      jsonb_build_object('project_id', v_payment.reference_id));
  END IF;

  RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  -- Log the error but still try to keep payment as success (money was taken)
  PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'rpc_error',
    jsonb_build_object('error', SQLERRM, 'payment_type', v_payment.payment_type));
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================================================
-- 4. Data fix: Reset inflated project_access_expires_at for affected user
--    Only reset if their current value exceeds registration-based entitlement
-- ============================================================================

-- Note: profiles.email is PII-encrypted, so lookup via auth.users or user ID
UPDATE profiles
SET project_access_expires_at = created_at + INTERVAL '1 month'
WHERE id = (SELECT id FROM auth.users WHERE email = 'beji.matiashvili@gmail.com')
  AND project_access_expires_at > created_at + INTERVAL '1 month'
  AND NOT EXISTS (
    SELECT 1 FROM project_subscriptions
    WHERE user_id = profiles.id
    AND status = 'active'
    AND expires_at > NOW()
  );
