-- =============================================================================
-- Migration 205: Free-project lecturers — admin-managed payment exemption
-- =============================================================================
-- Purpose:
--   Allow admins to grant individual lecturers the ability to create projects
--   without paying the budget via Keepz. When a lecturer in this list creates
--   a project with budget > 0, the project activates immediately instead of
--   landing in `status = 'pending_payment'`.
--
-- Changes:
--   1. Add profiles.can_create_free_projects boolean (default FALSE).
--   2. Partial index on the granted set for fast admin-list lookups.
--   3. BEFORE INSERT trigger on projects:
--        - If budget > 0 AND lecturer is NOT exempt: force status='pending_payment'.
--        - Otherwise: leave status as inserted (DB default 'active').
--      This is authoritative — closes the prior gap where the client decided
--      project status. Existing client behaviour is preserved (still inserts
--      'pending_payment' when budget > 0); the trigger just enforces it.
--
-- Down-migration:
--   DROP TRIGGER IF EXISTS trg_set_project_pending_payment ON public.projects;
--   DROP FUNCTION IF EXISTS public.set_project_pending_payment_if_required();
--   DROP INDEX IF EXISTS public.idx_profiles_free_projects;
--   ALTER TABLE public.profiles DROP COLUMN IF EXISTS can_create_free_projects;
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Column on profiles
-- -----------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_create_free_projects BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.can_create_free_projects IS
  'Admin-granted exemption: when TRUE, this lecturer''s projects skip the Keepz budget payment and activate immediately.';

-- -----------------------------------------------------------------------------
-- 2. Partial index for the admin "free-project lecturers" list query
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_profiles_free_projects
  ON public.profiles (id)
  WHERE can_create_free_projects = TRUE;

-- -----------------------------------------------------------------------------
-- 3. Trigger: enforce pending_payment for non-exempt lecturers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_project_pending_payment_if_required()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_is_exempt BOOLEAN;
BEGIN
  -- Only relevant when budget is positive. budget = 0 stays 'active' as before.
  IF NEW.budget IS NULL OR NEW.budget <= 0 THEN
    RETURN NEW;
  END IF;

  -- Look up exemption flag for the project creator.
  SELECT COALESCE(can_create_free_projects, FALSE)
    INTO v_is_exempt
    FROM public.profiles
    WHERE id = NEW.user_id;

  -- Non-exempt lecturers: force pending_payment regardless of what the client sent.
  IF NOT COALESCE(v_is_exempt, FALSE) THEN
    NEW.status := 'pending_payment';
  END IF;

  -- Exempt lecturers: leave NEW.status alone (defaults to 'active' or whatever
  -- the client passed). The CHECK constraint on status still applies.

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_project_pending_payment_if_required() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_set_project_pending_payment ON public.projects;
CREATE TRIGGER trg_set_project_pending_payment
  BEFORE INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_pending_payment_if_required();

COMMENT ON FUNCTION public.set_project_pending_payment_if_required() IS
  'Migration 205: BEFORE INSERT on projects. Forces status=pending_payment when budget>0 and the creator is not in the free-project lecturers list.';

COMMIT;
