-- Migration 230: Drop AND role='lecturer' from approve/reject lecturer RPCs.
--
-- Mig 228 added an `AND role = 'lecturer'` filter to approve_lecturer_account /
-- reject_lecturer_account. But mig 172 (fix_role_escalation_handle_new_user)
-- intentionally keeps lecturer applicants at role='student' with
-- lecturer_status='pending' until an admin approves — so the new filter makes
-- the UPDATE match zero rows and the RPC raises "Pending lecturer profile not
-- found", which the API surfaces as a 500.
--
-- Fix: match on lecturer_status='pending' regardless of role. Keep mig 185's
-- legacy NULL-status branch (role='lecturer' AND is_approved=false) untouched
-- so we don't accidentally promote arbitrary student rows that have neither
-- flag set.

BEGIN;

CREATE OR REPLACE FUNCTION public.approve_lecturer_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.check_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can approve lecturer accounts';
  END IF;

  UPDATE public.profiles
  SET
    role = 'lecturer',
    is_approved = true,
    lecturer_status = 'approved',
    updated_at = NOW()
  WHERE id = p_user_id
    AND (
      lecturer_status = 'pending'
      OR (lecturer_status IS NULL AND is_approved IS NOT TRUE AND role = 'lecturer')
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending lecturer profile not found for user %', p_user_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_lecturer_account(p_user_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.check_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can reject lecturer accounts';
  END IF;

  UPDATE public.profiles
  SET
    is_approved = false,
    lecturer_status = 'rejected',
    updated_at = NOW()
  WHERE id = p_user_id
    AND (
      lecturer_status = 'pending'
      OR (lecturer_status IS NULL AND is_approved IS NOT TRUE AND role = 'lecturer')
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending lecturer profile not found for user %', p_user_id;
  END IF;
END;
$$;

COMMIT;
