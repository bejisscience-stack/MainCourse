/**
 * PII Encryption utilities
 * Database-level encryption via pgcrypto — this file provides
 * client-side type helpers only. No crypto logic runs in the browser.
 */

export const PII_FIELDS = [
  "email",
  "full_name",
  "bank_account_number",
] as const;

export type PIIField = (typeof PII_FIELDS)[number];

/**
 * Checks if a value looks like it was encrypted (base64-encoded pgp output).
 * Useful for debugging/logging — never for security decisions.
 */
export function isEncrypted(value: string | null | undefined): boolean {
  if (!value) return false;
  // PGP symmetric encrypted data encoded as base64 starts with "ww0E" or similar
  // and is significantly longer than typical plaintext values
  return /^[A-Za-z0-9+/]{40,}={0,2}$/.test(value);
}
