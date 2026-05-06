-- Drop the anonymous insert policy on coming_soon_emails.
-- All inserts now flow through /api/public/coming-soon, which uses the
-- service role (bypasses RLS) and rate-limits by IP via subscribeLimiter.
-- The "Allow admin select" policy from migration 090 is intentionally left
-- in place so admin reads continue to work.
DROP POLICY IF EXISTS "Allow anonymous insert" ON public.coming_soon_emails;
