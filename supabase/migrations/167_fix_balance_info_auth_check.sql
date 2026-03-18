-- Migration 167: Add auth.uid() check to get_user_balance_info (BUG-05 IDOR fix)
-- Previously any authenticated user could read any other user's balance/bank info.

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
  -- BUG-05: Prevent IDOR — users can only view their own balance info
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'unauthorized: can only view own balance info';
  END IF;

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
