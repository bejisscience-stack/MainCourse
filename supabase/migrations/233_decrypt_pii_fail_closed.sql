-- 233_decrypt_pii_fail_closed.sql
-- Make public.decrypt_pii() fail-closed: return NULL (with WARNING) when the
-- vault key is missing or pgp_sym_decrypt throws, instead of returning the
-- ciphertext (current fail-open behavior from migration 144).
--
-- Callers using COALESCE(decrypt_pii(p.encrypted_x), p.x) will fall through to
-- p.x, which mig 144 NULLed out — so end result is NULL rather than leaked
-- ciphertext.
--
-- Grants: CREATE OR REPLACE preserves existing privileges (mig 174/175 already
-- revoked from PUBLIC/anon/authenticated/service_role). Re-revoke defensively.

CREATE OR REPLACE FUNCTION public.decrypt_pii(p_encrypted TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key TEXT;
  v_result TEXT;
BEGIN
  IF p_encrypted IS NULL OR p_encrypted = '' THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'pii_encryption_key' LIMIT 1;
  IF v_key IS NULL OR v_key = '' THEN
    RAISE WARNING 'decrypt_pii: pii_encryption_key not found in vault';
    RETURN NULL;
  END IF;

  BEGIN
    v_result := pgp_sym_decrypt(decode(p_encrypted, 'base64'), v_key);
    RETURN v_result;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'decrypt_pii: decryption failed: %', SQLERRM;
    RETURN NULL;
  END;
END;
$$;

-- Re-grant: revoke from PUBLIC/anon/authenticated (mig 174/175 state)
REVOKE ALL ON FUNCTION public.decrypt_pii(TEXT) FROM PUBLIC, anon, authenticated, service_role;
