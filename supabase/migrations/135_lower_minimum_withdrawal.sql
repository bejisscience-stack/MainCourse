-- Migration: Lower minimum withdrawal amount from 20 GEL to 0.10 GEL for testing
-- Affects: withdrawal_requests table CHECK constraint + create_withdrawal_request RPC

-- Step 1: Update CHECK constraint on withdrawal_requests.amount
-- ============================================
ALTER TABLE public.withdrawal_requests DROP CONSTRAINT IF EXISTS withdrawal_requests_amount_check;
ALTER TABLE public.withdrawal_requests ADD CONSTRAINT withdrawal_requests_amount_check CHECK (amount >= 0.10);

-- Step 2: Recreate create_withdrawal_request with updated minimum
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
  v_balance DECIMAL;
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

  -- Get user balance
  SELECT COALESCE(balance, 0) INTO v_balance
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance. Available: % GEL', v_balance;
  END IF;

  -- Create the withdrawal request
  INSERT INTO public.withdrawal_requests (user_id, user_type, amount, bank_account_number)
  VALUES (v_user_id, v_user_type, p_amount, p_bank_account_number)
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;
