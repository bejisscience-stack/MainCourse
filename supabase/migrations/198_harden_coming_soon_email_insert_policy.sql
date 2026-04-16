-- Migration 198: Harden anonymous inserts on coming_soon_emails
-- Preserve public lead-capture behavior while avoiding WITH CHECK (true).

BEGIN;

DROP POLICY IF EXISTS "Allow anonymous insert" ON public.coming_soon_emails;

CREATE POLICY "Allow anonymous insert"
ON public.coming_soon_emails
FOR INSERT
WITH CHECK (
  email IS NOT NULL
  AND email = trim(email)
  AND length(email) BETWEEN 5 AND 254
  AND position(' ' IN email) = 0
  AND position('@' IN email) > 1
  AND position('.' IN split_part(email, '@', 2)) > 1
);

COMMIT;
