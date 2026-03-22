-- Migration 191: Restore `extensions` in search_path for pgcrypto-dependent functions
-- Migration 183 changed search_path to `public, pg_temp` on all SECURITY DEFINER
-- functions, but three functions use pgp_sym_encrypt/decrypt from pgcrypto which
-- lives in the `extensions` schema. Without it, IBAN decryption returns NULL.

ALTER FUNCTION public.get_withdrawal_requests_admin(TEXT)
  SET search_path = public, extensions, pg_temp;

ALTER FUNCTION public.encrypt_withdrawal_bank_account()
  SET search_path = public, extensions, pg_temp;

ALTER FUNCTION public.auto_encrypt_pii()
  SET search_path = public, extensions, pg_temp;
