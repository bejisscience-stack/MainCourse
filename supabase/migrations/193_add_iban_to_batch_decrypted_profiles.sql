-- Migration 193: Add bank_account_number to batch get_decrypted_profiles
-- The single-user version (get_decrypted_profile) already returns it,
-- but the batch version was missing it — admin withdrawals needs current IBAN.
-- DROP required because RETURNS TABLE shape changed (added bank_account_number).

DROP FUNCTION IF EXISTS public.get_decrypted_profiles(UUID[]);

CREATE OR REPLACE FUNCTION public.get_decrypted_profiles(p_user_ids UUID[])
RETURNS TABLE (
  id UUID,
  username TEXT,
  email TEXT,
  full_name TEXT,
  bank_account_number TEXT,
  role TEXT,
  balance DECIMAL(10, 2),
  referral_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.username,
    COALESCE(public.decrypt_pii(p.encrypted_email), p.email) AS email,
    COALESCE(public.decrypt_pii(p.encrypted_full_name), p.full_name) AS full_name,
    COALESCE(public.decrypt_pii(p.encrypted_bank_account_number), p.bank_account_number) AS bank_account_number,
    p.role,
    p.balance,
    p.referral_code
  FROM public.profiles p
  WHERE p.id = ANY(p_user_ids);
END;
$$;

-- Restore service_role-only grant (from migration 174)
REVOKE ALL ON FUNCTION public.get_decrypted_profiles(UUID[]) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_decrypted_profiles(UUID[]) TO service_role;
