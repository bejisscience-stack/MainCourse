-- Migration 244: Atomic status flip + redacted callback_payload for Keepz
--
-- Closes audit findings A-5 and A-15 from final_security_guide.md.
--
--   A-5: complete_keepz_payment used to do
--          (a) UPDATE keepz_payments SET status='success' …
--          (b) BEGIN … EXCEPTION END (enrollments, balance credits, …)
--        PL/pgSQL EXCEPTION opens a sub-transaction; on raise, only the inner
--        block's effects are rolled back — the prior status flip is kept in the
--        outer transaction. A user therefore could end up paid + status=success
--        but with no enrollment / no lecturer credit. Fix: move the status flip
--        INSIDE the BEGIN…EXCEPTION block. Successful path is byte-identical
--        from the user's perspective; failure path now leaves status untouched
--        ('pending'/'created') so Keepz retry, the create-order verification
--        path, or admin re-trigger can resolve it.
--
--   A-15: callback_payload = p_callback_payload persisted the entire decrypted
--        Keepz payload, including cardInfo (mask, brand, expiration, token).
--        Fix: route the persisted JSON through public._keepz_redact_callback,
--        an allowlist projection that keeps only reconciliation-relevant keys
--        and (when present) a SHA-256 hash of cardInfo.token in place of the
--        raw token. pgcrypto.digest is already enabled on this project.
--
-- All other behaviour (signature, return shape, recovery branch, commission
-- math, audit logging, search_path, SECURITY DEFINER) is preserved verbatim
-- relative to the live RPC body. The only return-shape change is on the
-- exception path: payment_recorded is now FALSE because the row hasn't been
-- flipped — the callback consumer at app/api/payments/keepz/callback/route.ts
-- already handles both branches, so no client change is required.

-- =============================================================================
-- Helper: allowlist redactor for the persisted callback payload
-- =============================================================================
CREATE OR REPLACE FUNCTION public._keepz_redact_callback(p jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'status',             p->'status',
    'orderStatus',        p->'orderStatus',
    'integratorOrderId',  p->'integratorOrderId',
    'paymentMethodType',  p->'paymentMethodType',
    'amount',             p->'amount',
    'currency',           p->'currency',
    'paid_at',            p->'paid_at',
    'cardTokenSha256',
      CASE WHEN p ? 'cardInfo' AND (p->'cardInfo'->>'token') IS NOT NULL
           -- pgcrypto.digest is qualified explicitly because Supabase installs
           -- the extension into the `extensions` schema, not `public`.
           THEN to_jsonb(encode(extensions.digest(p->'cardInfo'->>'token', 'sha256'), 'hex'))
           ELSE NULL
      END
  ))
$$;

REVOKE ALL ON FUNCTION public._keepz_redact_callback(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._keepz_redact_callback(jsonb) TO service_role;

COMMENT ON FUNCTION public._keepz_redact_callback(jsonb) IS
  'Allowlist projection for keepz callback persistence. Strips cardInfo and replaces cardInfo.token with a SHA-256 hash. Used by complete_keepz_payment.';

-- =============================================================================
-- complete_keepz_payment(uuid, jsonb)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.complete_keepz_payment(p_keepz_order_id uuid, p_callback_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_payment keepz_payments%ROWTYPE;
  v_course_id UUID;
  v_bundle_course RECORD;
  v_ref_exists BOOLEAN;
  v_course courses%ROWTYPE;
  v_referral referrals%ROWTYPE;
  v_bundle course_bundles%ROWTYPE;
  v_commission DECIMAL;
  v_referrer_amount DECIMAL;
  v_lecturer_amount DECIMAL;
  v_balance_already_credited BOOLEAN;
  v_keepz_fee DECIMAL;
  v_platform_commission DECIMAL;
  v_project_budget DECIMAL;
  v_rows_affected INTEGER;
BEGIN
  SELECT * INTO v_payment FROM keepz_payments
    WHERE keepz_order_id = p_keepz_order_id
    FOR UPDATE;

  IF NOT FOUND THEN
    PERFORM log_payment_event(NULL, p_keepz_order_id, NULL, 'rpc_payment_not_found',
      jsonb_build_object('keepz_order_id', p_keepz_order_id));
    RETURN jsonb_build_object('success', false, 'error', 'Payment not found');
  END IF;

  v_keepz_fee := CASE v_payment.payment_method_type
    WHEN 'card' THEN v_payment.amount * 0.025
    WHEN 'bank' THEN CASE WHEN v_payment.amount <= 10000 THEN v_payment.amount * 0.01
                      ELSE LEAST(v_payment.amount * 0.006, 100) END
    WHEN 'split' THEN v_payment.amount * 0.03
    ELSE v_payment.amount * 0.025
  END;
  v_keepz_fee := ROUND(v_keepz_fee, 2);

  -- ---------------------------------------------------------------------------
  -- Recovery branch — payment was already marked successful by a prior call.
  -- Preserves existing idempotency guards (NOT EXISTS balance_transactions …).
  -- ---------------------------------------------------------------------------
  IF v_payment.status = 'success' THEN
    PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'rpc_already_completed',
      jsonb_build_object('payment_type', v_payment.payment_type, 'checking_enrollment', true));

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

      IF v_course_id IS NOT NULL THEN
        SELECT NOT EXISTS (
          SELECT 1 FROM balance_transactions
          WHERE reference_id = v_payment.reference_id
          AND source IN ('course_purchase', 'referral_commission')
        ) INTO v_balance_already_credited;

        IF v_balance_already_credited THEN
          SELECT * INTO v_course FROM courses WHERE id = v_course_id;
          IF FOUND AND v_payment.amount > 0 THEN
            v_platform_commission := ROUND(v_payment.amount * 0.03, 2);

            SELECT r.* INTO v_referral FROM referrals r
              WHERE r.enrollment_request_id = v_payment.reference_id LIMIT 1;

            IF FOUND AND v_course.referral_commission_percentage > 0 THEN
              v_commission := (v_course.referral_commission_percentage::DECIMAL / 100) * v_payment.amount;
              v_referrer_amount := v_commission;
              v_lecturer_amount := GREATEST(v_payment.amount - v_keepz_fee - v_platform_commission - v_commission, 0);

              PERFORM credit_user_balance(v_referral.referrer_id, v_referrer_amount, 'referral_commission', v_payment.reference_id, 'enrollment_request', 'Referral commission (Keepz payment recovery)');
              PERFORM credit_user_balance(v_course.lecturer_id, v_lecturer_amount, 'course_purchase', v_payment.reference_id, 'enrollment_request', 'Course sale (Keepz payment recovery)');
            ELSE
              v_lecturer_amount := GREATEST(v_payment.amount - v_keepz_fee - v_platform_commission, 0);
              PERFORM credit_user_balance(v_course.lecturer_id, v_lecturer_amount, 'course_purchase', v_payment.reference_id, 'enrollment_request', 'Course sale (Keepz payment recovery)');
            END IF;

            UPDATE keepz_payments SET platform_commission = v_platform_commission WHERE id = v_payment.id;

            PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'balance_recovered',
              jsonb_build_object('course_id', v_course_id, 'amount', v_payment.amount, 'keepz_fee', v_keepz_fee, 'platform_commission', v_platform_commission));
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

      SELECT NOT EXISTS (
        SELECT 1 FROM balance_transactions
        WHERE reference_id = v_payment.reference_id
        AND source = 'course_purchase'
      ) INTO v_balance_already_credited;

      IF v_balance_already_credited THEN
        SELECT cb.* INTO v_bundle FROM course_bundles cb
          JOIN bundle_enrollment_requests ber ON ber.bundle_id = cb.id
          WHERE ber.id = v_payment.reference_id;

        IF FOUND AND v_payment.amount > 0 THEN
          v_platform_commission := ROUND(v_payment.amount * 0.03, 2);
          v_lecturer_amount := GREATEST(v_payment.amount - v_keepz_fee - v_platform_commission, 0);
          PERFORM credit_user_balance(v_bundle.lecturer_id, v_lecturer_amount, 'course_purchase', v_payment.reference_id, 'bundle_enrollment_request', 'Bundle sale (Keepz payment recovery)');

          UPDATE keepz_payments SET platform_commission = v_platform_commission WHERE id = v_payment.id;

          PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'bundle_balance_recovered',
            jsonb_build_object('bundle_id', v_bundle.id, 'amount', v_payment.amount, 'keepz_fee', v_keepz_fee, 'platform_commission', v_platform_commission));
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

      IF v_payment.platform_commission = 0 OR v_payment.platform_commission IS NULL THEN
        SELECT budget INTO v_project_budget FROM projects WHERE id = v_payment.reference_id;
        IF v_project_budget IS NOT NULL AND v_project_budget > 0 THEN
          v_platform_commission := ROUND(v_project_budget * 0.20, 2);
          UPDATE keepz_payments SET platform_commission = v_platform_commission WHERE id = v_payment.id;
          PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'project_commission_recovered',
            jsonb_build_object('project_id', v_payment.reference_id, 'platform_commission', v_platform_commission));
        END IF;
      END IF;
    END IF;

    RETURN jsonb_build_object('success', true, 'already_completed', true);
  END IF;

  -- ---------------------------------------------------------------------------
  -- Pre-compute platform commission so the success-flip and the per-type side
  -- effects share the same value. (Same math as before; just hoisted.)
  -- ---------------------------------------------------------------------------
  v_platform_commission := 0;
  IF v_payment.payment_type = 'course_enrollment' THEN
    SELECT course_id INTO v_course_id FROM enrollment_requests WHERE id = v_payment.reference_id;
    IF v_course_id IS NOT NULL AND v_payment.amount > 0 THEN
      v_platform_commission := ROUND(v_payment.amount * 0.03, 2);
    END IF;
  ELSIF v_payment.payment_type = 'bundle_enrollment' THEN
    IF v_payment.amount > 0 THEN
      v_platform_commission := ROUND(v_payment.amount * 0.03, 2);
    END IF;
  ELSIF v_payment.payment_type = 'project_budget' THEN
    SELECT budget INTO v_project_budget FROM projects WHERE id = v_payment.reference_id;
    IF v_project_budget IS NOT NULL AND v_project_budget > 0 THEN
      v_platform_commission := ROUND(v_project_budget * 0.20, 2);
    ELSE
      v_platform_commission := 0;
    END IF;
  END IF;

  -- ---------------------------------------------------------------------------
  -- Atomic block: status flip + business logic.
  -- A-5 fix: the SET status='success' UPDATE now lives INSIDE the
  -- BEGIN…EXCEPTION block so any raise rolls it back together with the
  -- enrollments / balance credits. The previous ordering let the status
  -- survive a sub-transaction rollback.
  -- ---------------------------------------------------------------------------
  BEGIN
    UPDATE keepz_payments SET
      status = 'success',
      callback_payload = public._keepz_redact_callback(p_callback_payload),
      paid_at = NOW(),
      updated_at = NOW(),
      keepz_commission = v_keepz_fee,
      platform_commission = v_platform_commission
    WHERE id = v_payment.id;

    PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'payment_completed',
      jsonb_build_object('payment_type', v_payment.payment_type, 'amount', v_payment.amount, 'keepz_fee', v_keepz_fee, 'platform_commission', v_platform_commission));

    IF v_payment.payment_type = 'course_enrollment' THEN
      SELECT EXISTS(SELECT 1 FROM enrollment_requests WHERE id = v_payment.reference_id) INTO v_ref_exists;

      IF NOT v_ref_exists THEN
        PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'missing_enrollment_request',
          jsonb_build_object('reference_id', v_payment.reference_id));
        RETURN jsonb_build_object('success', true, 'warning', 'Enrollment request not found — payment recorded but enrollment needs manual creation');
      END IF;

      UPDATE enrollment_requests SET status = 'approved', reviewed_at = NOW()
        WHERE id = v_payment.reference_id AND status = 'pending';
      GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
      IF v_rows_affected = 0 THEN
        PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'enrollment_already_approved',
          jsonb_build_object('reference_id', v_payment.reference_id));
        RETURN jsonb_build_object('success', true, 'already_completed', true);
      END IF;

      IF v_course_id IS NULL THEN
        SELECT course_id INTO v_course_id FROM enrollment_requests WHERE id = v_payment.reference_id;
      END IF;

      IF v_course_id IS NULL THEN
        PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'null_course_id',
          jsonb_build_object('reference_id', v_payment.reference_id));
        RETURN jsonb_build_object('success', true, 'warning', 'Course ID not found in enrollment request');
      END IF;

      INSERT INTO enrollments (user_id, course_id, approved_at)
        VALUES (v_payment.user_id, v_course_id, NOW())
        ON CONFLICT (user_id, course_id) DO UPDATE SET approved_at = NOW();

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

      SELECT * INTO v_course FROM courses WHERE id = v_course_id;

      IF FOUND AND v_payment.amount > 0 THEN
        SELECT r.* INTO v_referral FROM referrals r
          WHERE r.enrollment_request_id = v_payment.reference_id LIMIT 1;

        IF FOUND AND v_course.referral_commission_percentage > 0 THEN
          v_commission := (v_course.referral_commission_percentage::DECIMAL / 100) * v_payment.amount;
          v_referrer_amount := v_commission;
          v_lecturer_amount := GREATEST(v_payment.amount - v_keepz_fee - v_platform_commission - v_commission, 0);

          PERFORM credit_user_balance(v_referral.referrer_id, v_referrer_amount, 'referral_commission', v_payment.reference_id, 'enrollment_request', 'Referral commission from Keepz payment');
          PERFORM credit_user_balance(v_course.lecturer_id, v_lecturer_amount, 'course_purchase', v_payment.reference_id, 'enrollment_request', 'Course sale from Keepz payment (after referral, Keepz fee, and platform commission)');

          PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'balance_credited_with_referral',
            jsonb_build_object('course_id', v_course_id, 'lecturer_amount', v_lecturer_amount, 'referrer_amount', v_referrer_amount, 'referrer_id', v_referral.referrer_id, 'keepz_fee', v_keepz_fee, 'platform_commission', v_platform_commission, 'paid_amount', v_payment.amount));
        ELSE
          v_lecturer_amount := GREATEST(v_payment.amount - v_keepz_fee - v_platform_commission, 0);
          PERFORM credit_user_balance(v_course.lecturer_id, v_lecturer_amount, 'course_purchase', v_payment.reference_id, 'enrollment_request', 'Course sale from Keepz payment (after Keepz fee and platform commission)');

          PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'balance_credited',
            jsonb_build_object('course_id', v_course_id, 'amount', v_lecturer_amount, 'lecturer_id', v_course.lecturer_id, 'keepz_fee', v_keepz_fee, 'platform_commission', v_platform_commission, 'paid_amount', v_payment.amount));
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

      INSERT INTO bundle_enrollments (user_id, bundle_id)
        SELECT v_payment.user_id, bundle_id
        FROM bundle_enrollment_requests
        WHERE id = v_payment.reference_id
      ON CONFLICT (user_id, bundle_id) DO NOTHING;

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

      SELECT cb.* INTO v_bundle FROM course_bundles cb
        JOIN bundle_enrollment_requests ber ON ber.bundle_id = cb.id
        WHERE ber.id = v_payment.reference_id;

      IF FOUND AND v_payment.amount > 0 THEN
        v_lecturer_amount := GREATEST(v_payment.amount - v_keepz_fee - v_platform_commission, 0);
        PERFORM credit_user_balance(v_bundle.lecturer_id, v_lecturer_amount, 'course_purchase', v_payment.reference_id, 'bundle_enrollment_request', 'Bundle sale from Keepz payment (after Keepz fee and platform commission)');

        PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'bundle_balance_credited',
          jsonb_build_object('bundle_id', v_bundle.id, 'amount', v_lecturer_amount, 'lecturer_id', v_bundle.lecturer_id, 'keepz_fee', v_keepz_fee, 'platform_commission', v_platform_commission, 'paid_amount', v_payment.amount));
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
        jsonb_build_object('project_id', v_payment.reference_id, 'platform_commission', v_platform_commission));
    END IF;

    RETURN jsonb_build_object('success', true);

  EXCEPTION WHEN OTHERS THEN
    -- A-5 fix: payment_recorded is now FALSE — the status='success' UPDATE
    -- was inside this BEGIN block and has been rolled back along with the
    -- side effects. Caller (callback route) and Keepz retry will resolve.
    PERFORM log_payment_event(v_payment.id, p_keepz_order_id, v_payment.user_id, 'rpc_business_logic_error_rolled_back',
      jsonb_build_object('error', SQLERRM, 'payment_type', v_payment.payment_type, 'payment_recorded', false));
    RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'payment_recorded', false);
  END;

END;
$function$;
