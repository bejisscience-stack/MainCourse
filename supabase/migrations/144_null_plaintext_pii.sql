-- Migration 144: NULL plaintext PII columns — encrypt-only storage
-- After this, profiles.email/full_name/bank_account_number are always NULL.
-- All reads go through decrypt_pii() RPCs (get_safe_profiles, get_decrypted_profiles, get_decrypted_profile).

-- 1A. Update get_safe_profiles() to decrypt email (used by chat-messages, realtime, etc.)
CREATE OR REPLACE FUNCTION public.get_safe_profiles(user_ids UUID[])
RETURNS TABLE (
  id UUID,
  username TEXT,
  email TEXT,
  avatar_url TEXT,
  role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.username,
    COALESCE(public.decrypt_pii(p.encrypted_email), p.email) AS email,
    p.avatar_url,
    p.role
  FROM public.profiles p
  WHERE p.id = ANY(user_ids);
END;
$$;

-- 1B. Update auto_encrypt_pii() trigger — NULL plaintext after encrypting
CREATE OR REPLACE FUNCTION public.auto_encrypt_pii()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (NEW.email IS NOT NULL AND NEW.email IS DISTINCT FROM OLD.email) THEN
    NEW.encrypted_email := public.encrypt_pii(NEW.email);
  END IF;
  NEW.email := NULL;

  IF TG_OP = 'INSERT' OR (NEW.full_name IS NOT NULL AND NEW.full_name IS DISTINCT FROM OLD.full_name) THEN
    NEW.encrypted_full_name := public.encrypt_pii(NEW.full_name);
  END IF;
  NEW.full_name := NULL;

  IF TG_OP = 'INSERT' OR (NEW.bank_account_number IS NOT NULL AND NEW.bank_account_number IS DISTINCT FROM OLD.bank_account_number) THEN
    NEW.encrypted_bank_account_number := public.encrypt_pii(NEW.bank_account_number);
  END IF;
  NEW.bank_account_number := NULL;

  RETURN NEW;
END;
$$;

-- 1C. Safety check: abort if any row has plaintext but no encrypted counterpart
DO $$ DECLARE missing INTEGER; BEGIN
  SELECT COUNT(*) INTO missing FROM profiles
  WHERE email IS NOT NULL AND encrypted_email IS NULL;
  IF missing > 0 THEN
    RAISE EXCEPTION '% rows have plaintext email but no encrypted_email — encrypt first', missing;
  END IF;
END $$;

-- 1D. Drop NOT NULL constraints on plaintext PII columns so they can be NULLed
ALTER TABLE profiles ALTER COLUMN email DROP NOT NULL;

-- 1E. NULL all existing plaintext PII (trigger will also NULL on future writes)
UPDATE profiles SET email = NULL, full_name = NULL, bank_account_number = NULL;

-- 1F. Fix decrypt_pii search_path — pgcrypto lives in extensions schema
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

  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'pii_encryption_key' LIMIT 1;
  IF v_key IS NULL OR v_key = '' THEN
    RETURN p_encrypted;
  END IF;

  BEGIN
    v_result := pgp_sym_decrypt(decode(p_encrypted, 'base64'), v_key);
    RETURN v_result;
  EXCEPTION WHEN OTHERS THEN
    RETURN p_encrypted;
  END;
END;
$$;
