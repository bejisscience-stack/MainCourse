-- Migration 217: Gate withdrawals on KYC verification
--
-- Refines public.create_withdrawal_request (defined in migration 162) to require
-- profiles.kyc_status = 'verified'. The error string 'KYC verification required'
-- is the agreed sentinel — app/api/withdrawals/route.ts translates it into a
-- typed 403 { error: 'kyc_required' } so the client can route the user back
-- into the KYC modal.
--
-- Also stamps withdrawal_requests.kyc_submission_id with the latest verified
-- submission for audit linkage.

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
  v_user_id            UUID;
  v_user_type          TEXT;
  v_kyc_status         TEXT;
  v_kyc_submission_id  UUID;
  v_pending_withdrawal DECIMAL;
  v_request_id         UUID;
BEGIN
  -- Get the authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get user type + KYC status in one shot (hot path)
  SELECT role, kyc_status
    INTO v_user_type, v_kyc_status
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_user_type IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF v_user_type = 'admin' THEN
    RAISE EXCEPTION 'Admins cannot request withdrawals';
  END IF;

  -- KYC gate (added in this migration)
  IF v_kyc_status IS DISTINCT FROM 'verified' THEN
    RAISE EXCEPTION 'KYC verification required' USING ERRCODE = 'P0001';
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

  -- Resolve the verified KYC submission for audit linkage (most recent)
  SELECT id INTO v_kyc_submission_id
  FROM public.kyc_submissions
  WHERE user_id = v_user_id AND status = 'verified'
  ORDER BY reviewed_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  -- Create the withdrawal request first (to get v_request_id)
  INSERT INTO public.withdrawal_requests (
    user_id, user_type, amount, bank_account_number, kyc_submission_id
  )
  VALUES (
    v_user_id, v_user_type, p_amount, p_bank_account_number, v_kyc_submission_id
  )
  RETURNING id INTO v_request_id;

  -- Hold funds atomically — debit_user_balance raises on insufficient balance
  -- and the entire transaction (INSERT included) rolls back.
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
