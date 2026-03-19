-- SEC-06: Remove unnecessary service_role access to PII encrypt/decrypt helpers.
-- These functions are only called internally by other SECURITY DEFINER functions
-- and triggers (auto_encrypt_pii, get_decrypted_profile, get_user_balance_info, etc.).
-- SECURITY DEFINER functions run as the DB owner, so no external access is needed.

REVOKE ALL ON FUNCTION public.decrypt_pii(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decrypt_pii(TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION public.decrypt_pii(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.decrypt_pii(TEXT) FROM service_role;

REVOKE ALL ON FUNCTION public.encrypt_pii(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.encrypt_pii(TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION public.encrypt_pii(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.encrypt_pii(TEXT) FROM service_role;
