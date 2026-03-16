-- Migration: PII Encryption (ISO 27001 Compliance)
-- Description: Adds database-level encryption for PII fields in profiles table
-- using pgcrypto with symmetric encryption (pgp_sym_encrypt/pgp_sym_decrypt).
-- Dual-column approach: encrypted_* columns alongside existing plaintext columns.
-- Auto-encrypt trigger writes to both on INSERT/UPDATE. Zero downtime.
--
-- IMPORTANT: After applying this migration, you must set the encryption key:
--   ALTER DATABASE postgres SET app.pii_encryption_key = 'your-secret-key-here';
-- Then run a one-time backfill:
--   UPDATE profiles SET email = email WHERE email IS NOT NULL;
-- This triggers the auto-encrypt trigger to populate encrypted_* columns.

-- ============================================
-- PART 1: Enable pgcrypto extension
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- PART 2: Encryption/Decryption helper functions
-- ============================================

-- encrypt_pii: Encrypts plaintext using pgp_sym_encrypt, returns base64-encoded
CREATE OR REPLACE FUNCTION public.encrypt_pii(p_value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_key TEXT;
BEGIN
  IF p_value IS NULL OR p_value = '' THEN
    RETURN NULL;
  END IF;

  v_key := current_setting('app.pii_encryption_key', true);
  IF v_key IS NULL OR v_key = '' THEN
    -- No key configured, return NULL (plaintext column remains as fallback)
    RETURN NULL;
  END IF;

  RETURN encode(pgp_sym_encrypt(p_value, v_key), 'base64');
END;
$$;

-- decrypt_pii: Decrypts base64-encoded encrypted text, with graceful fallback
CREATE OR REPLACE FUNCTION public.decrypt_pii(p_encrypted TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_key TEXT;
  v_result TEXT;
BEGIN
  IF p_encrypted IS NULL OR p_encrypted = '' THEN
    RETURN NULL;
  END IF;

  v_key := current_setting('app.pii_encryption_key', true);
  IF v_key IS NULL OR v_key = '' THEN
    -- No key configured, return as-is (may be plaintext during migration)
    RETURN p_encrypted;
  END IF;

  BEGIN
    v_result := pgp_sym_decrypt(decode(p_encrypted, 'base64'), v_key);
    RETURN v_result;
  EXCEPTION WHEN OTHERS THEN
    -- If decryption fails (e.g. value is not encrypted), return as-is
    RETURN p_encrypted;
  END;
END;
$$;

-- ============================================
-- PART 3: Add encrypted columns to profiles
-- ============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS encrypted_email TEXT,
  ADD COLUMN IF NOT EXISTS encrypted_full_name TEXT,
  ADD COLUMN IF NOT EXISTS encrypted_bank_account_number TEXT;

-- ============================================
-- PART 4: Auto-encrypt trigger
-- ============================================

CREATE OR REPLACE FUNCTION public.auto_encrypt_pii()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Encrypt email if changed
  IF TG_OP = 'INSERT' OR (NEW.email IS DISTINCT FROM OLD.email) THEN
    NEW.encrypted_email := public.encrypt_pii(NEW.email);
  END IF;

  -- Encrypt full_name if changed
  IF TG_OP = 'INSERT' OR (NEW.full_name IS DISTINCT FROM OLD.full_name) THEN
    NEW.encrypted_full_name := public.encrypt_pii(NEW.full_name);
  END IF;

  -- Encrypt bank_account_number if changed
  IF TG_OP = 'INSERT' OR (NEW.bank_account_number IS DISTINCT FROM OLD.bank_account_number) THEN
    NEW.encrypted_bank_account_number := public.encrypt_pii(NEW.bank_account_number);
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS trg_auto_encrypt_pii ON public.profiles;

CREATE TRIGGER trg_auto_encrypt_pii
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_encrypt_pii();

-- ============================================
-- PART 5: get_decrypted_profile — single user
-- ============================================

CREATE OR REPLACE FUNCTION public.get_decrypted_profile(p_user_id UUID)
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
  WHERE p.id = p_user_id;
END;
$$;

-- ============================================
-- PART 6: get_decrypted_profiles — batch by IDs
-- ============================================

CREATE OR REPLACE FUNCTION public.get_decrypted_profiles(p_user_ids UUID[])
RETURNS TABLE (
  id UUID,
  username TEXT,
  email TEXT,
  full_name TEXT,
  role TEXT,
  balance DECIMAL(10, 2),
  referral_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.username,
    COALESCE(public.decrypt_pii(p.encrypted_email), p.email) AS email,
    COALESCE(public.decrypt_pii(p.encrypted_full_name), p.full_name) AS full_name,
    p.role,
    p.balance,
    p.referral_code
  FROM public.profiles p
  WHERE p.id = ANY(p_user_ids);
END;
$$;

-- ============================================
-- PART 7: get_decrypted_profiles_by_referral — batch by referral codes
-- ============================================

CREATE OR REPLACE FUNCTION public.get_decrypted_profiles_by_referral(p_referral_codes TEXT[])
RETURNS TABLE (
  id UUID,
  username TEXT,
  email TEXT,
  referral_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.username,
    COALESCE(public.decrypt_pii(p.encrypted_email), p.email) AS email,
    p.referral_code
  FROM public.profiles p
  WHERE p.referral_code = ANY(p_referral_codes);
END;
$$;

-- ============================================
-- PART 8: Update get_user_balance_info to decrypt bank_account_number
-- ============================================

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
      WHERE bt.user_id = p_user_id AND bt.transaction_type = 'credit'
    ), 0::DECIMAL(10,2)) as total_earned,
    COALESCE((
      SELECT SUM(bt.amount)
      FROM public.balance_transactions bt
      WHERE bt.user_id = p_user_id
      AND bt.transaction_type = 'debit'
      AND bt.source = 'withdrawal'
    ), 0::DECIMAL(10,2)) as total_withdrawn
  FROM public.profiles p
  WHERE p.id = p_user_id;
END;
$$;
