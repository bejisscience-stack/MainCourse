-- Migration 231: Document why anon EXECUTE on has_project_access(uuid) is intentional.
--
-- Mirrors mig 223's COMMENT on check_is_admin(uuid) so the Supabase advisor
-- finding for has_project_access has inline justification visible to the next
-- reviewer.
--
-- History recap:
--   mig 176 revoked anon EXECUTE on this function.
--   mig 189 added auth.uid() IS NOT NULL guards in RLS policies that reference it.
--   mig 194 documented the planner-time root cause and re-granted anon for check_is_admin.
--   mig 229 re-granted anon EXECUTE for has_project_access (commit d670b66) but
--          left the rationale only in the SQL-file comment, not as a DB COMMENT.
--
-- Why anon EXECUTE must remain: PostgreSQL checks function EXECUTE privilege at
-- query *plan* time, before any runtime short-circuit. RLS policies on projects,
-- channels, messages, project_criteria, project_submissions, and submission_reviews
-- reference has_project_access(auth.uid()). Revoking anon EXECUTE makes anon
-- SELECT against any of those tables fail with "permission denied for function".
--
-- Why the leak is acceptable: the function returns one boolean per UUID input —
-- "does this UUID currently have project access?". No row data, no PII.

COMMENT ON FUNCTION public.has_project_access(uuid) IS
  'SECURITY DEFINER. anon EXECUTE is intentional (migs 189/194/229): RLS policies on projects, channels, messages, project_criteria, project_submissions, submission_reviews reference this function. PostgreSQL checks EXECUTE at query plan time, before the auth.uid() IS NOT NULL guard short-circuits, so revoking from anon breaks anon SELECT on those tables. Returns boolean only; no row data leak.';
