-- Migration: Atomic pay_submission function
-- Fixes PAY-02 (race condition) by performing entire payout in one transaction
-- with FOR UPDATE row locks. Returns JSONB (no RAISE EXCEPTION).

CREATE OR REPLACE FUNCTION public.pay_submission(
  p_review_id UUID,
  p_payout_amount DECIMAL,
  p_admin_id UUID,
  p_submission_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_review submission_reviews%ROWTYPE;
  v_student_id UUID;
  v_project_id UUID;
  v_project_budget DECIMAL(10,2);
  v_project_spent DECIMAL(10,2);
  v_remaining DECIMAL(10,2);
  v_balance_before DECIMAL(10,2);
  v_balance_after DECIMAL(10,2);
  v_student_role TEXT;
  v_rounded_payout DECIMAL(10,2);
  v_project_remaining DECIMAL(10,2);
  v_tx_id UUID;
BEGIN
  -- 0. Validate inputs
  IF p_payout_amount IS NULL OR p_payout_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_amount');
  END IF;

  v_rounded_payout := ROUND(p_payout_amount, 2);

  -- 1. Verify admin
  IF NOT check_is_admin(p_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_admin');
  END IF;

  -- 2. Lock and fetch the review row
  SELECT * INTO v_review
    FROM submission_reviews
    WHERE id = p_review_id AND submission_id = p_submission_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'review_not_found');
  END IF;

  IF v_review.status != 'accepted' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_accepted');
  END IF;

  IF v_review.paid_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_paid');
  END IF;

  -- 3. Get submission for student user_id
  SELECT user_id, project_id INTO v_student_id, v_project_id
    FROM project_submissions
    WHERE id = p_submission_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'submission_not_found');
  END IF;

  -- Use review's project_id if set, otherwise submission's
  v_project_id := COALESCE(v_review.project_id, v_project_id);

  -- 4. Lock and check project budget
  SELECT budget, spent INTO v_project_budget, v_project_spent
    FROM projects
    WHERE id = v_project_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'project_not_found');
  END IF;

  v_remaining := ROUND(v_project_budget - v_project_spent, 2);

  IF v_remaining < v_rounded_payout THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'insufficient_budget',
      'remaining', v_remaining
    );
  END IF;

  -- 5. Lock student profile and get current balance
  SELECT balance, role INTO v_balance_before, v_student_role
    FROM profiles
    WHERE id = v_student_id
    FOR UPDATE;

  IF v_balance_before IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'student_not_found');
  END IF;

  -- 6. Credit student balance (relative update)
  UPDATE profiles
    SET balance = balance + v_rounded_payout
    WHERE id = v_student_id
    RETURNING balance INTO v_balance_after;

  -- 7. Debit project budget (relative update)
  UPDATE projects
    SET spent = spent + v_rounded_payout
    WHERE id = v_project_id
    RETURNING ROUND(budget - spent, 2) INTO v_project_remaining;

  -- 8. Mark review as paid
  UPDATE submission_reviews
    SET paid_at = NOW(),
        paid_by = p_admin_id,
        payout_amount = v_rounded_payout
    WHERE id = p_review_id;

  -- 9. Create balance transaction record
  INSERT INTO balance_transactions (
    user_id, user_type, amount, transaction_type,
    source, reference_id, reference_type,
    description, balance_before, balance_after
  ) VALUES (
    v_student_id,
    COALESCE(v_student_role, 'student'),
    v_rounded_payout,
    'credit',
    'submission_payout',
    v_review.id,
    'submission_review',
    'Payout for video submission (' || COALESCE(v_review.platform, 'all') || ' platform)',
    v_balance_before,
    v_balance_after
  ) RETURNING id INTO v_tx_id;

  -- 10. Insert audit log (within same transaction)
  INSERT INTO audit_log (admin_user_id, action, target_table, target_id, metadata)
  VALUES (
    p_admin_id,
    'submission_payout',
    'submission_reviews',
    p_review_id::TEXT,
    jsonb_build_object(
      'payout_amount', v_rounded_payout,
      'student_id', v_student_id,
      'project_id', v_project_id,
      'balance_before', v_balance_before,
      'balance_after', v_balance_after,
      'project_remaining', v_project_remaining,
      'transaction_id', v_tx_id
    )
  );

  -- 11. Return success
  RETURN jsonb_build_object(
    'success', true,
    'payout_amount', v_rounded_payout,
    'balance_after', v_balance_after,
    'project_remaining', v_project_remaining,
    'review_id', v_review.id,
    'transaction_id', v_tx_id
  );
END;
$$;

-- Restrict to service_role only
REVOKE EXECUTE ON FUNCTION public.pay_submission(UUID, DECIMAL, UUID, UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.pay_submission(UUID, DECIMAL, UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.pay_submission(UUID, DECIMAL, UUID, UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.pay_submission(UUID, DECIMAL, UUID, UUID) TO service_role;
