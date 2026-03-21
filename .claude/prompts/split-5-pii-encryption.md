# Split 5: PII Encryption (ISO 27001 Compliance)

## Goal

Encrypt all personal information (IBAN, email, full_name, phone) at the database level using Supabase's `pgcrypto` extension. Data must be:

- Encrypted at rest in the database
- Decryptable by admin API routes when needed
- Transparent to end users (they see their own data normally)
- Compliant with ISO 27001 data protection requirements

## Architecture

Use PostgreSQL `pgcrypto` with symmetric encryption (`pgp_sym_encrypt` / `pgp_sym_decrypt`).
The encryption key is stored as a Supabase secret (environment variable), never in code.

## Files to Modify

### 1. New Migration: `supabase/migrations/143_pii_encryption.sql`

```sql
-- Enable pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create helper functions for encrypt/decrypt using a server-side secret
-- The secret key is stored in vault or as a database setting

-- Encryption function
CREATE OR REPLACE FUNCTION encrypt_pii(plain_text TEXT)
RETURNS TEXT AS $$
BEGIN
  IF plain_text IS NULL THEN RETURN NULL; END IF;
  RETURN encode(pgp_sym_encrypt(plain_text, current_setting('app.pii_encryption_key')), 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decryption function (SECURITY DEFINER = runs as owner, bypasses RLS)
CREATE OR REPLACE FUNCTION decrypt_pii(encrypted_text TEXT)
RETURNS TEXT AS $$
BEGIN
  IF encrypted_text IS NULL THEN RETURN NULL; END IF;
  RETURN pgp_sym_decrypt(decode(encrypted_text, 'base64'), current_setting('app.pii_encryption_key'));
EXCEPTION WHEN OTHERS THEN
  RETURN encrypted_text; -- Return as-is if not encrypted (migration safety)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add encrypted columns (keep originals during migration, rename after)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS encrypted_email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS encrypted_bank_account_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS encrypted_full_name TEXT;

-- Migrate existing data (run with key set)
-- This must be executed AFTER setting: ALTER DATABASE postgres SET app.pii_encryption_key = 'your-key';
-- UPDATE profiles SET
--   encrypted_email = encrypt_pii(email),
--   encrypted_bank_account_number = encrypt_pii(bank_account_number),
--   encrypted_full_name = encrypt_pii(full_name)
-- WHERE encrypted_email IS NULL;

-- Create views for admin access with decryption
CREATE OR REPLACE FUNCTION get_decrypted_profile(p_user_id UUID)
RETURNS TABLE(
  id UUID,
  email TEXT,
  full_name TEXT,
  bank_account_number TEXT,
  username TEXT,
  role TEXT,
  balance NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    COALESCE(decrypt_pii(p.encrypted_email), p.email) as email,
    COALESCE(decrypt_pii(p.encrypted_full_name), p.full_name) as full_name,
    COALESCE(decrypt_pii(p.encrypted_bank_account_number), p.bank_account_number) as bank_account_number,
    p.username,
    p.role,
    p.balance
  FROM profiles p
  WHERE p.id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**IMPORTANT:** This migration creates the infrastructure. The actual data migration (encrypting existing rows) should be run separately via SQL editor after the encryption key is configured. Add a comment in the migration explaining this.

### 2. New File: `lib/encryption.ts`

```typescript
// Client-side encryption utilities for PII
// NOTE: Actual encryption happens at the database level via pgcrypto
// This file provides helper types and constants

export const PII_FIELDS = [
  "email",
  "bank_account_number",
  "full_name",
] as const;
export type PIIField = (typeof PII_FIELDS)[number];

// Helper to check if a value looks encrypted (base64-encoded pgp data)
export function isEncrypted(value: string | null): boolean {
  if (!value) return false;
  // PGP encrypted data in base64 starts with specific patterns
  return value.length > 50 && /^[A-Za-z0-9+/=]+$/.test(value);
}
```

### 3. `app/api/balance/route.ts`

- GET: When returning `bank_account_number`, call decryption if using encrypted column
  - Use service role client to call `decrypt_pii()` or use `get_decrypted_profile()`
- PATCH: When updating `bank_account_number`, encrypt before storing
  - Call `encrypt_pii()` via RPC or store in `encrypted_bank_account_number`

### 4. `app/api/withdrawals/route.ts`

- POST: When creating withdrawal, use encrypted IBAN from profile
- GET: When returning own withdrawals, decrypt IBAN for display

### 5. `app/api/admin/withdrawals/route.ts`

- GET: Use `get_decrypted_profile()` to return decrypted IBANs and emails to admins
- Ensure admin auth check is present (it already is via `verifyAdmin()`)

### 6. `app/api/admin/withdrawals/[requestId]/approve/route.ts`

- When fetching user email for notification, use decrypted version

### 7. `app/api/admin/withdrawals/[requestId]/reject/route.ts`

- Same as approve — decrypt email for sending rejection notification

### 8. `app/api/admin/lecturer-approvals/route.ts`

- Use decrypted profile data when returning lecturer info to admin

### 9. `app/api/admin/lecturer-approvals/[id]/approve/route.ts`

- Decrypt email before sending approval notification

### 10. `app/api/admin/lecturer-approvals/[id]/reject/route.ts`

- Decrypt email before sending rejection notification

### 11. `components/AdminWithdrawals.tsx`

- No changes needed — it just displays what the API returns (API handles decryption)

### 12. `hooks/useBalance.ts`

- No changes needed — it calls the API which handles encryption/decryption

### 13. `app/settings/page.tsx`

- The IBAN display should work as before since the API decrypts it
- When user updates IBAN, the API encrypts it

### 14. `types/balance.ts`

- No type changes needed — the types represent decrypted values as seen by the app

## Strategy Notes

- **Dual-column approach**: Keep original columns during migration, add encrypted\_\* columns
- **Gradual migration**: New writes go to encrypted columns; reads try encrypted first, fall back to original
- **Zero downtime**: The COALESCE in `get_decrypted_profile` handles both encrypted and unencrypted data
- **Key management**: The encryption key must be set as a PostgreSQL config: `ALTER DATABASE postgres SET app.pii_encryption_key = '<generated-key>';`
- The key should be a strong random string (32+ chars), stored ONLY in Supabase database config

## DO NOT Touch

- `components/chat/` files (Agent 1)
- `lib/keepz.ts` or payment Keepz files (Agent 2)
- `components/VideoPlayer.tsx` (Agent 3)
- `app/payment/success/page.tsx` or `app/payment/failed/page.tsx` (Agent 4)
- `lib/email.ts` or `lib/email-templates.ts` (these receive already-decrypted data)

## Validation

1. Run `npm run build` — must pass with zero errors
2. Verify migration SQL is syntactically correct
3. Verify all API routes compile correctly
4. Verify the encryption/decryption flow is consistent (encrypt on write, decrypt on read)
5. Commit with message: "feat: encrypt PII at database level for ISO 27001 compliance"
6. Output DONE when build passes.
