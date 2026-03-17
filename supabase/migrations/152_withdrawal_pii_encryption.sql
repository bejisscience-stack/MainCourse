-- Migration 152: Encrypt bank_account_number in withdrawal_requests (SEC-04)
-- Matches the dual-column pattern from migrations 143/144 for profiles PII.
-- Uses Supabase Vault key 'pii_encryption_key' + pgcrypto pgp_sym_encrypt/decrypt.

-- ============================================
-- PART 1: Add encrypted column
-- ============================================

ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS encrypted_bank_account_number TEXT;

-- ============================================
-- PART 2: Auto-encrypt trigger function
-- ============================================

CREATE OR REPLACE FUNCTION public.encrypt_withdrawal_bank_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key TEXT;
BEGIN
  -- Only act when bank_account_number is provided
  IF NEW.bank_account_number IS NOT NULL AND NEW.bank_account_number != '' THEN
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'pii_encryption_key'
    LIMIT 1;

    IF v_key IS NOT NULL AND v_key != '' THEN
      NEW.encrypted_bank_account_number := encode(pgp_sym_encrypt(NEW.bank_account_number, v_key), 'base64');
      NEW.bank_account_number := NULL;
    ELSE
      RAISE WARNING 'pii_encryption_key not found in Vault — bank_account_number stored in plaintext';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================
-- PART 3: Attach trigger
-- ============================================

DROP TRIGGER IF EXISTS trg_encrypt_withdrawal_bank_account ON public.withdrawal_requests;

CREATE TRIGGER trg_encrypt_withdrawal_bank_account
  BEFORE INSERT OR UPDATE OF bank_account_number
  ON public.withdrawal_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_withdrawal_bank_account();

-- ============================================
-- PART 4: Backfill existing plaintext rows
-- ============================================

DO $$
DECLARE
  v_key TEXT;
  v_count INTEGER;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'pii_encryption_key'
  LIMIT 1;

  IF v_key IS NULL OR v_key = '' THEN
    RAISE WARNING 'pii_encryption_key not found — skipping backfill';
    RETURN;
  END IF;

  UPDATE public.withdrawal_requests
  SET
    encrypted_bank_account_number = encode(pgp_sym_encrypt(bank_account_number, v_key), 'base64'),
    bank_account_number = NULL
  WHERE bank_account_number IS NOT NULL
    AND bank_account_number != ''
    AND encrypted_bank_account_number IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled % withdrawal_requests rows', v_count;
END $$;

-- ============================================
-- PART 5: Drop NOT NULL on plaintext column (needed so trigger can NULL it)
-- ============================================

ALTER TABLE public.withdrawal_requests ALTER COLUMN bank_account_number DROP NOT NULL;

-- ============================================
-- PART 6: Recreate get_withdrawal_requests_admin with decryption
-- ============================================

DROP FUNCTION IF EXISTS public.get_withdrawal_requests_admin(TEXT);

CREATE OR REPLACE FUNCTION public.get_withdrawal_requests_admin(filter_status TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_type TEXT,
  amount DECIMAL(10, 2),
  bank_account_number TEXT,
  status TEXT,
  admin_notes TEXT,
  processed_at TIMESTAMPTZ,
  processed_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
DECLARE
  v_key TEXT;
BEGIN
  -- Verify caller is admin using the check_is_admin function
  IF NOT public.check_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can access withdrawal requests';
  END IF;

  -- Fetch decryption key once
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'pii_encryption_key'
  LIMIT 1;

  -- Return all or filtered results based on status parameter
  IF filter_status IS NULL OR filter_status = '' OR filter_status = 'all' THEN
    RETURN QUERY
    SELECT
      wr.id,
      wr.user_id,
      wr.user_type,
      wr.amount,
      CASE
        WHEN wr.encrypted_bank_account_number IS NOT NULL AND v_key IS NOT NULL
        THEN pgp_sym_decrypt(decode(wr.encrypted_bank_account_number, 'base64'), v_key)
        ELSE wr.bank_account_number
      END,
      wr.status,
      wr.admin_notes,
      wr.processed_at,
      wr.processed_by,
      wr.created_at,
      wr.updated_at
    FROM public.withdrawal_requests wr
    ORDER BY wr.created_at DESC;
  ELSE
    RETURN QUERY
    SELECT
      wr.id,
      wr.user_id,
      wr.user_type,
      wr.amount,
      CASE
        WHEN wr.encrypted_bank_account_number IS NOT NULL AND v_key IS NOT NULL
        THEN pgp_sym_decrypt(decode(wr.encrypted_bank_account_number, 'base64'), v_key)
        ELSE wr.bank_account_number
      END,
      wr.status,
      wr.admin_notes,
      wr.processed_at,
      wr.processed_by,
      wr.created_at,
      wr.updated_at
    FROM public.withdrawal_requests wr
    WHERE wr.status = filter_status
    ORDER BY wr.created_at DESC;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE
SET search_path = public, extensions;

COMMENT ON FUNCTION public.get_withdrawal_requests_admin IS 'Fetches ALL withdrawal requests for admins with decrypted bank account numbers, bypasses RLS via SECURITY DEFINER.';
