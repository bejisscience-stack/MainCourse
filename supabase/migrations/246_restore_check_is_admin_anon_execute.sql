-- Migration 246: Restore anon EXECUTE on public.check_is_admin(uuid)
--
-- Mig 241 revoked anon EXECUTE on this function as part of the security audit
-- (A-22 / SEC-013) on the assumption that anon never reaches it because the
-- referencing RLS policies are paired with `auth.uid() IS NOT NULL` guards.
--
-- That assumption holds for the *direct* references in `profiles` SELECT, but
-- check_is_admin is also reached **transitively** through `enrollments` RLS:
--   - public.projects SELECT policy "Users can view projects in enrolled courses"
--     contains  EXISTS (SELECT 1 FROM enrollments e WHERE ...)
--   - public.enrollments SELECT policy "Admins can view all enrollments"
--     has qual  check_is_admin(auth.uid())
-- PostgreSQL validates function EXECUTE at PLAN time (before runtime guards
-- short-circuit), so any anon SELECT on public.projects fails with
-- `permission denied for function check_is_admin` -- breaking the public
-- ActiveProjectsCarousel on the homepage.
--
-- Re-grant anon EXECUTE. Safe because:
--   - SECURITY DEFINER, returns boolean only (no row data leak)
--   - returns FALSE for NULL input (anon has no auth.uid())
--   - admin UUIDs are not guessable, so anon EXECUTE does not enable
--     enumeration in practice (mirrors mig 231's reasoning for
--     has_project_access).

BEGIN;

GRANT EXECUTE ON FUNCTION public.check_is_admin(uuid) TO anon;

COMMENT ON FUNCTION public.check_is_admin(uuid) IS
  'SECURITY DEFINER. anon EXECUTE intentional (migs 194/241/246). '
  'Referenced (directly or transitively) by RLS policies on profiles, '
  'enrollments, channels, messages, message_attachments, muted_users, '
  'project_subscriptions, videos, message_reactions, chat_pinned_messages, '
  'enrollment_requests. Postgres validates function EXECUTE at plan time '
  'before auth.uid() guards short-circuit, so anon EXECUTE is required for '
  'these policies to evaluate during anon SELECTs that reach them through '
  'subqueries (e.g. the public projects -> enrollments path). Returns boolean '
  'only; no row data is leaked.';

COMMIT;
