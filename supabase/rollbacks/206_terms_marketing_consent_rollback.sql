-- Rollback for migration 206: drop terms acceptance + marketing consent columns
--
-- DESTRUCTIVE: this drops user consent records. Only run if migration 206 must
-- be reverted on a fresh environment. Do NOT run in production once consent has
-- been collected from real users.

BEGIN;

DROP INDEX IF EXISTS public.idx_profiles_marketing_consent;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS marketing_emails_consent_at,
  DROP COLUMN IF EXISTS marketing_emails_consent,
  DROP COLUMN IF EXISTS terms_accepted_at,
  DROP COLUMN IF EXISTS terms_accepted;

COMMIT;
