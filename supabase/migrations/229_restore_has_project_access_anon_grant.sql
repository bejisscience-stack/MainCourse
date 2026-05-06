-- Migration 229: Restore anon EXECUTE for has_project_access(uuid)
--
-- Migration 194 documents why anon EXECUTE is intentional for helpers used in
-- RLS policies: PostgreSQL checks function EXECUTE privileges while planning,
-- before auth.uid() guards can short-circuit to false for anonymous requests.
-- The function returns only a boolean and returns false for NULL auth context.

GRANT EXECUTE ON FUNCTION public.has_project_access(UUID) TO anon;
