-- Migration: Create balance management functions
-- Description: Functions for crediting and debiting user balances atomically

-- Step 1: Function to credit balance
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

  -- Get user type and current balance
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

-- Step 2: Function to debit balance
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

  -- Get user type and current balance
  SELECT role, balance INTO v_user_type, v_balance_before
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_user_type IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Check sufficient balance
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

-- Step 3: Function to get user balance with transaction history
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
    p.bank_account_number,
    COALESCE((
      SELECT SUM(wr.amount) 
      FROM public.withdrawal_requests wr 
      WHERE wr.user_id = p_user_id AND wr.status = 'pending'
    ), 0::DECIMAL(10,2)) as pending_withdrawal,
    COALESCE((
      SELECT SUM(bt.amount) 
      FROM public.balance_transactions bt 
      WHERE bt.user_id = p_user_id AND bt.transaction_type = 'credit'
    ), 0::DECIMAL(10,2)) as total_earned,
    COALESCE((
      SELECT SUM(bt.amount) 
      FROM public.balance_transactions bt 
      WHERE bt.user_id = p_user_id 
      AND bt.transaction_type = 'debit' 
      AND bt.source = 'withdrawal'
    ), 0::DECIMAL(10,2)) as total_withdrawn
  FROM public.profiles p
  WHERE p.id = p_user_id;
END;
$$;

