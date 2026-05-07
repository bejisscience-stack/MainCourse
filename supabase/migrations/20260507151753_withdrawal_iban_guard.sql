-- A-20: enforce Georgian IBAN format inside create_withdrawal_request.
--
-- Mirrors app/api/withdrawals/route.ts regex (^GE[0-9]{2}[A-Z]{2}[0-9]{16}$)
-- so a direct PostgREST RPC call cannot bypass the route's check. The route
-- regex stays in place as the friendly-error layer; this is the authoritative
-- gate. Body is otherwise identical to migration 217.
--
-- search_path is reasserted to (public, pg_temp) — migration 233 set this via
-- ALTER FUNCTION; CREATE OR REPLACE does not preserve SET clauses, so we
-- re-issue ALTER FUNCTION below to avoid silently regressing the hardening.

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
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- A-20: Georgian IBAN format guard (regex parity with API route).
  IF coalesce(p_bank_account_number, '') !~ '^GE[0-9]{2}[A-Z]{2}[0-9]{16}$' THEN
    RAISE EXCEPTION 'Invalid Georgian IBAN format'
      USING ERRCODE = '22023'; -- invalid_parameter_value
  END IF;

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

  IF v_kyc_status IS DISTINCT FROM 'verified' THEN
    RAISE EXCEPTION 'KYC verification required' USING ERRCODE = 'P0001';
  END IF;

  IF p_amount < 0.10 THEN
    RAISE EXCEPTION 'Minimum withdrawal amount is 0.10 GEL';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_pending_withdrawal
  FROM public.withdrawal_requests
  WHERE user_id = v_user_id AND status = 'pending';

  IF v_pending_withdrawal > 0 THEN
    RAISE EXCEPTION 'You already have a pending withdrawal request';
  END IF;

  SELECT id INTO v_kyc_submission_id
  FROM public.kyc_submissions
  WHERE user_id = v_user_id AND status = 'verified'
  ORDER BY reviewed_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  INSERT INTO public.withdrawal_requests (
    user_id, user_type, amount, bank_account_number, kyc_submission_id
  )
  VALUES (
    v_user_id, v_user_type, p_amount, p_bank_account_number, v_kyc_submission_id
  )
  RETURNING id INTO v_request_id;

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

-- Reassert search_path hardening from migration 233.
ALTER FUNCTION public.create_withdrawal_request(numeric, text)
  SET search_path = public, pg_temp;
