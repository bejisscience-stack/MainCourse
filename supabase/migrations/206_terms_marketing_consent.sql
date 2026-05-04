-- Migration 206: Terms acceptance + marketing email consent on profiles
--
-- Adds explicit per-user consent records for:
--   1. Terms & Privacy acceptance (required to register)
--   2. Marketing email consent (optional)
--
-- Existing accounts are backfilled to TRUE for both flags (per product decision —
-- they registered under the prior passive "by registering you agree" notice).
-- Future accounts must set these explicitly via handle_new_user() (migration 207)
-- or the /complete-profile flow (for OAuth users).

BEGIN;

-- Step 1: Add columns with DEFAULT TRUE so existing rows backfill to "agreed".
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS marketing_emails_consent BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS marketing_emails_consent_at TIMESTAMPTZ;

-- Step 2: Backfill *_at columns for existing rows to created_at (audit trail).
UPDATE public.profiles
SET terms_accepted_at = created_at
WHERE terms_accepted_at IS NULL;

UPDATE public.profiles
SET marketing_emails_consent_at = created_at
WHERE marketing_emails_consent_at IS NULL;

-- Step 3: Flip defaults to FALSE so future inserts must be explicit.
ALTER TABLE public.profiles
  ALTER COLUMN terms_accepted SET DEFAULT FALSE,
  ALTER COLUMN marketing_emails_consent SET DEFAULT FALSE;

-- Step 4: Partial index to speed up the "consenting recipients" query path
-- used by the AdminEmailManager broadcast tool.
CREATE INDEX IF NOT EXISTS idx_profiles_marketing_consent
  ON public.profiles(marketing_emails_consent)
  WHERE marketing_emails_consent = TRUE;

COMMENT ON COLUMN public.profiles.terms_accepted IS
  'TRUE when the user has accepted the Terms & Privacy Policy. Required to register.';
COMMENT ON COLUMN public.profiles.terms_accepted_at IS
  'When terms were accepted. For pre-206 accounts this equals created_at (implicit consent).';
COMMENT ON COLUMN public.profiles.marketing_emails_consent IS
  'TRUE when the user has opted in to marketing emails. Used by AdminEmailManager to filter recipients.';
COMMENT ON COLUMN public.profiles.marketing_emails_consent_at IS
  'When marketing consent was given (or last changed). NULL if user has never opted in.';

COMMIT;
