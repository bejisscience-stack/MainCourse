-- Migration 154: Add row-level locking to balance functions (SEC-23)
-- Prevents race conditions where concurrent calls read stale balance_before.
-- Uses SELECT ... FOR UPDATE to lock the profile row before reading balance.

-- ============================================
-- PART 1: credit_user_balance with row locking
-- ============================================

CREATE OR REPLACE FUNCTION public.credit_user_balance(
  p_user_id UUID,
  p_amount DECIMAL(10, 2),
  p_source TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction_id UUID;
  v_user_type TEXT;
  v_balance_before DECIMAL(10, 2);
  v_balance_after DECIMAL(10, 2);
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  -- SEC-23: Lock the profile row to prevent concurrent balance updates
  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  -- Get user type and current balance (row is now locked)
  SELECT role, balance INTO v_user_type, v_balance_before
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_user_type IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Update balance atomically
  UPDATE public.profiles
  SET balance = balance + p_amount
  WHERE id = p_user_id
  RETURNING balance INTO v_balance_after;

  -- Create transaction record
  INSERT INTO public.balance_transactions (
    user_id,
    user_type,
    amount,
    transaction_type,
    source,
    reference_id,
    reference_type,
    description,
    balance_before,
    balance_after
  )
  VALUES (
    p_user_id,
    v_user_type,
    p_amount,
    'credit',
    p_source,
    p_reference_id,
    p_reference_type,
    p_description,
    v_balance_before,
    v_balance_after
  )
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$;

-- ============================================
-- PART 2: debit_user_balance with row locking
-- ============================================

CREATE OR REPLACE FUNCTION public.debit_user_balance(
  p_user_id UUID,
  p_amount DECIMAL(10, 2),
  p_source TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction_id UUID;
  v_user_type TEXT;
  v_balance_before DECIMAL(10, 2);
  v_balance_after DECIMAL(10, 2);
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  -- SEC-23: Lock the profile row to prevent concurrent balance updates
  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  -- Get user type and current balance (row is now locked)
  SELECT role, balance INTO v_user_type, v_balance_before
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_user_type IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Check sufficient balance (with locked row, this is now race-safe)
  IF v_balance_before < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance. Current balance: %', v_balance_before;
  END IF;

  -- Update balance atomically
  UPDATE public.profiles
  SET balance = balance - p_amount
  WHERE id = p_user_id
  RETURNING balance INTO v_balance_after;

  -- Create transaction record
  INSERT INTO public.balance_transactions (
    user_id,
    user_type,
    amount,
    transaction_type,
    source,
    reference_id,
    reference_type,
    description,
    balance_before,
    balance_after
  )
  VALUES (
    p_user_id,
    v_user_type,
    p_amount,
    'debit',
    p_source,
    p_reference_id,
    p_reference_type,
    p_description,
    v_balance_before,
    v_balance_after
  )
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$;
