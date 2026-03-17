-- Migration 162: Atomic Withdrawal Lifecycle
-- Funds are held on request creation, refunded on rejection, no double-deduction on approval.
-- Requires: no pending withdrawal requests exist before applying.

-- ============================================
-- PART 0: Transition safety guard
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.withdrawal_requests WHERE status = 'pending') THEN
    RAISE EXCEPTION 'Cannot apply migration: pending withdrawal requests exist. Approve or reject all pending requests first.';
  END IF;
END $$;

-- ============================================
-- PART 1: Expand balance_transactions source CHECK
-- ============================================

ALTER TABLE public.balance_transactions
DROP CONSTRAINT IF EXISTS balance_transactions_source_check;

ALTER TABLE public.balance_transactions
ADD CONSTRAINT balance_transactions_source_check
CHECK (source IN (
  'referral_commission', 'course_purchase', 'withdrawal',
  'admin_adjustment', 'submission_payout',
  'withdrawal_hold', 'withdrawal_refund'
));

-- ============================================
-- PART 2: Redefine create_withdrawal_request — atomic hold
-- ============================================

CREATE OR REPLACE FUNCTION public.create_withdrawal_request(
  p_amount DECIMAL,
  p_bank_account_number TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_type TEXT;
  v_pending_withdrawal DECIMAL;
  v_request_id UUID;
BEGIN
  -- Get the authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get user type
  SELECT role INTO v_user_type
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_user_type IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF v_user_type = 'admin' THEN
    RAISE EXCEPTION 'Admins cannot request withdrawals';
  END IF;

  -- Validate amount
  IF p_amount < 0.10 THEN
    RAISE EXCEPTION 'Minimum withdrawal amount is 0.10 GEL';
  END IF;

  -- Check if user has pending withdrawal
  SELECT COALESCE(SUM(amount), 0) INTO v_pending_withdrawal
  FROM public.withdrawal_requests
  WHERE user_id = v_user_id AND status = 'pending';

  IF v_pending_withdrawal > 0 THEN
    RAISE EXCEPTION 'You already have a pending withdrawal request';
  END IF;

  -- Create the withdrawal request first (to get v_request_id)
  INSERT INTO public.withdrawal_requests (user_id, user_type, amount, bank_account_number)
  VALUES (v_user_id, v_user_type, p_amount, p_bank_account_number)
  RETURNING id INTO v_request_id;

  -- Immediately hold funds via debit — uses FOR UPDATE row locking (migration 154)
  -- If insufficient balance, debit_user_balance raises an exception and the entire
  -- transaction rolls back, including the INSERT above
  PERFORM public.debit_user_balance(
    v_user_id,
    p_amount,
    'withdrawal_hold',
    v_request_id,
    'withdrawal_request',
    'Funds held for withdrawal request'
  );

  RETURN v_request_id;
END;
$$;

-- ============================================
-- PART 3: Redefine approve_withdrawal_request — no balance deduction
-- ============================================

CREATE OR REPLACE FUNCTION public.approve_withdrawal_request(p_request_id UUID, p_admin_notes TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_request public.withdrawal_requests%ROWTYPE;
BEGIN
  -- Verify admin
  SELECT id INTO v_admin_id
  FROM public.profiles
  WHERE id = auth.uid() AND role = 'admin';

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can approve withdrawal requests';
  END IF;

  -- Get the withdrawal request with row lock to prevent concurrent approve/reject
  SELECT * INTO v_request
  FROM public.withdrawal_requests
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal request not found or already processed';
  END IF;

  -- No balance deduction needed — funds were already held at creation time.
  -- Just mark as completed.
  UPDATE public.withdrawal_requests
  SET
    status = 'completed',
    admin_notes = COALESCE(p_admin_notes, admin_notes),
    processed_at = TIMEZONE('utc', NOW()),
    processed_by = v_admin_id,
    updated_at = TIMEZONE('utc', NOW())
  WHERE id = p_request_id;
END;
$$;

-- ============================================
-- PART 4: Redefine reject_withdrawal_request — refund held funds
-- ============================================

CREATE OR REPLACE FUNCTION public.reject_withdrawal_request(p_request_id UUID, p_admin_notes TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_request public.withdrawal_requests%ROWTYPE;
BEGIN
  -- Verify admin
  SELECT id INTO v_admin_id
  FROM public.profiles
  WHERE id = auth.uid() AND role = 'admin';

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can reject withdrawal requests';
  END IF;

  -- Get the withdrawal request with row lock to prevent concurrent approve/reject
  SELECT * INTO v_request
  FROM public.withdrawal_requests
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal request not found or already processed';
  END IF;

  -- Refund the held funds back to user
  PERFORM public.credit_user_balance(
    v_request.user_id,
    v_request.amount,
    'withdrawal_refund',
    p_request_id,
    'withdrawal_request',
    'Withdrawal request rejected — funds refunded'
  );

  -- Update withdrawal request status
  UPDATE public.withdrawal_requests
  SET
    status = 'rejected',
    admin_notes = COALESCE(p_admin_notes, 'Withdrawal request rejected'),
    processed_at = TIMEZONE('utc', NOW()),
    processed_by = v_admin_id,
    updated_at = TIMEZONE('utc', NOW())
  WHERE id = p_request_id;
END;
$$;

-- ============================================
-- PART 5: Update get_user_balance_info
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_balance_info(p_user_id UUID)
RETURNS TABLE (
  balance DECIMAL(10, 2),
  bank_account_number TEXT,
  pending_withdrawal DECIMAL(10, 2),
  total_earned DECIMAL(10, 2),
  total_withdrawn DECIMAL(10, 2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.balance,
    COALESCE(public.decrypt_pii(p.encrypted_bank_account_number), p.bank_account_number),
    COALESCE((
      SELECT SUM(wr.amount)
      FROM public.withdrawal_requests wr
      WHERE wr.user_id = p_user_id AND wr.status = 'pending'
    ), 0::DECIMAL(10,2)) as pending_withdrawal,
    COALESCE((
      SELECT SUM(bt.amount)
      FROM public.balance_transactions bt
      WHERE bt.user_id = p_user_id
      AND bt.transaction_type = 'credit'
      AND bt.source NOT IN ('withdrawal_refund')
    ), 0::DECIMAL(10,2)) as total_earned,
    COALESCE((
      SELECT SUM(wr.amount)
      FROM public.withdrawal_requests wr
      WHERE wr.user_id = p_user_id AND wr.status = 'completed'
    ), 0::DECIMAL(10,2)) as total_withdrawn
  FROM public.profiles p
  WHERE p.id = p_user_id;
END;
$$;
