-- Migration 173: Revoke public access to credit/debit balance functions (SEC-02, SEC-03)
--
-- credit_user_balance() and debit_user_balance() are SECURITY DEFINER functions
-- that were callable by any authenticated user via supabase.rpc().
-- This is a critical privilege escalation — anyone could mint or debit funds.
--
-- All legitimate callsites are from other SECURITY DEFINER functions
-- (complete_keepz_payment, approve_enrollment_request, etc.) which run as
-- the DB owner and are unaffected by REVOKE on PUBLIC/authenticated/anon.

-- ============================================
-- credit_user_balance
-- ============================================
REVOKE ALL ON FUNCTION public.credit_user_balance(UUID, NUMERIC, TEXT, UUID, TEXT, TEXT)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.credit_user_balance(UUID, NUMERIC, TEXT, UUID, TEXT, TEXT)
  FROM authenticated;
REVOKE ALL ON FUNCTION public.credit_user_balance(UUID, NUMERIC, TEXT, UUID, TEXT, TEXT)
  FROM anon;

GRANT EXECUTE ON FUNCTION public.credit_user_balance(UUID, NUMERIC, TEXT, UUID, TEXT, TEXT)
  TO service_role;

-- ============================================
-- debit_user_balance
-- ============================================
REVOKE ALL ON FUNCTION public.debit_user_balance(UUID, NUMERIC, TEXT, UUID, TEXT, TEXT)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.debit_user_balance(UUID, NUMERIC, TEXT, UUID, TEXT, TEXT)
  FROM authenticated;
REVOKE ALL ON FUNCTION public.debit_user_balance(UUID, NUMERIC, TEXT, UUID, TEXT, TEXT)
  FROM anon;

GRANT EXECUTE ON FUNCTION public.debit_user_balance(UUID, NUMERIC, TEXT, UUID, TEXT, TEXT)
  TO service_role;
