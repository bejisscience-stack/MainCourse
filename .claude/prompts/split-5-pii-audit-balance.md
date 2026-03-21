# Split 5: PII + Audit + Balance Migrations (SEC-04, SEC-20, SEC-21, SEC-22, SEC-23)

## Scope

Create new SQL migration files to fix PII encryption gaps, audit log security, and balance race conditions. You ONLY create NEW files listed below.

## Files to Create

- `supabase/migrations/152_withdrawal_pii_encryption.sql`
- `supabase/migrations/153_fix_audit_log_security.sql`
- `supabase/migrations/154_balance_credit_locking.sql`

## DO NOT Touch

- Any existing migration files
- Migration numbers 146-151 (Agents 3-4)
- Any TypeScript files
- Any files outside `supabase/migrations/`

## Fixes

### SEC-04: Encrypt bank account numbers in withdrawal_requests (CRITICAL)

**File:** `supabase/migrations/152_withdrawal_pii_encryption.sql`

First read `supabase/migrations/143_pii_encryption.sql` and `supabase/migrations/144_null_plaintext_pii.sql` to understand the existing PII encryption pattern (uses `pgp_sym_encrypt` via Supabase Vault with `pii_encryption_key` secret).

Then read `supabase/migrations/072_create_withdrawal_system.sql` (or similar) to understand the `withdrawal_requests` table structure.

Apply the same pattern to `withdrawal_requests.bank_account_number`:

```sql
-- Migration: Encrypt bank_account_number in withdrawal_requests

-- Add encrypted column
ALTER TABLE public.withdrawal_requests
ADD COLUMN IF NOT EXISTS encrypted_bank_account_number TEXT;

-- Create auto-encrypt trigger (same pattern as profiles PII)
CREATE OR REPLACE FUNCTION public.encrypt_withdrawal_bank_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key TEXT;
BEGIN
  -- Get encryption key from Vault
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'pii_encryption_key'
  LIMIT 1;

  IF v_key IS NULL THEN
    RAISE WARNING 'PII encryption key not found in Vault — bank account stored unencrypted';
    RETURN NEW;
  END IF;

  -- Encrypt the bank account number if provided
  IF NEW.bank_account_number IS NOT NULL AND NEW.bank_account_number != '' THEN
    NEW.encrypted_bank_account_number := pgp_sym_encrypt(NEW.bank_account_number, v_key);
    NEW.bank_account_number := NULL;  -- Clear plaintext
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_encrypt_withdrawal_bank_account ON public.withdrawal_requests;
CREATE TRIGGER trg_encrypt_withdrawal_bank_account
  BEFORE INSERT OR UPDATE OF bank_account_number ON public.withdrawal_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_withdrawal_bank_account();

-- Backfill existing plaintext records
DO $$
DECLARE
  v_key TEXT;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'pii_encryption_key'
  LIMIT 1;

  IF v_key IS NOT NULL THEN
    UPDATE public.withdrawal_requests
    SET encrypted_bank_account_number = pgp_sym_encrypt(bank_account_number, v_key),
        bank_account_number = NULL
    WHERE bank_account_number IS NOT NULL
      AND encrypted_bank_account_number IS NULL;
  END IF;
END;
$$;

-- Update admin RPC to decrypt bank account number
-- Read supabase/migrations/084_create_admin_fetch_rpc_functions.sql first
-- to find the get_withdrawal_requests_admin() function and recreate it
-- replacing wr.bank_account_number with:
-- CASE WHEN wr.encrypted_bank_account_number IS NOT NULL THEN
--   pgp_sym_decrypt(wr.encrypted_bank_account_number::bytea, v_key)
-- ELSE wr.bank_account_number END AS bank_account_number
```

**IMPORTANT:** Read migration 084 to get the full `get_withdrawal_requests_admin()` function body. Recreate it with the decryption logic. You need to add the Vault key lookup at the start of the function.

### SEC-20 + SEC-21: Fix audit log security (MEDIUM)

**File:** `supabase/migrations/153_fix_audit_log_security.sql`

First read `supabase/migrations/120_audit_log.sql` to understand the `insert_audit_log()` function.

1. Add admin check inside the function
2. Add input length validation

```sql
-- Migration: Fix audit log function — add admin check and input validation

CREATE OR REPLACE FUNCTION public.insert_audit_log(
  p_action TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id TEXT DEFAULT NULL,
  p_details JSONB DEFAULT NULL,
  p_admin_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_actor_id UUID;
BEGIN
  v_actor_id := COALESCE(p_admin_id, auth.uid());

  -- Verify caller is admin
  IF NOT public.check_is_admin(v_actor_id) THEN
    RAISE EXCEPTION 'Only admins can insert audit log entries';
  END IF;

  -- Input validation
  IF length(p_action) > 100 THEN
    RAISE EXCEPTION 'Action must be <= 100 characters';
  END IF;

  IF p_entity_type IS NOT NULL AND length(p_entity_type) > 50 THEN
    RAISE EXCEPTION 'Entity type must be <= 50 characters';
  END IF;

  INSERT INTO public.audit_log (action, entity_type, entity_id, details, admin_id)
  VALUES (p_action, p_entity_type, p_entity_id, p_details, v_actor_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
```

**IMPORTANT:** Read migration 120 first to match the exact function signature and table columns.

### SEC-23: Fix race condition in balance credit (MEDIUM)

**File:** `supabase/migrations/154_balance_credit_locking.sql`

First read `supabase/migrations/073_create_balance_functions.sql` to understand `credit_user_balance()`.

Add `SELECT ... FOR UPDATE` locking:

```sql
-- Migration: Fix race condition in credit_user_balance — add row locking

CREATE OR REPLACE FUNCTION public.credit_user_balance(
  p_user_id UUID,
  p_amount NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance_after NUMERIC;
BEGIN
  -- Lock the row to prevent concurrent updates
  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  UPDATE public.profiles
  SET balance = balance + p_amount
  WHERE id = p_user_id
  RETURNING balance INTO v_balance_after;

  RETURN v_balance_after;
END;
$$;
```

**IMPORTANT:** Read migration 073 first to match the exact function signature, parameters, and any additional logic (like balance_transactions inserts).

## Completion

Run `npm run build`. If it passes, commit with message:

```
fix(security): PII encryption, audit log security, balance race condition

SEC-04: Encrypt bank_account_number in withdrawal_requests using Vault key
SEC-20: Add admin check to insert_audit_log() function
SEC-21: Add input length validation to audit log function
SEC-23: Add FOR UPDATE locking in credit_user_balance to prevent race conditions
```

Output DONE when build passes.
