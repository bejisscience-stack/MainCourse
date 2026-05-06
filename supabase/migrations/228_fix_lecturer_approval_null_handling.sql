-- Migration 228: Align lecturer approve/reject with get_pending_lecturers when is_approved IS NULL
--
-- Mig 185 mapped NULL lecturer_status + NULL is_approved as "pending" in the admin list, but
-- approve_lecturer_account / reject_lecturer_account only matched is_approved = false. SQL `NULL = false`
-- is unknown, so those rows could never be approved/rejected.
--
-- Also: mig 177 revoked EXECUTE on insert_audit_log FROM authenticated, but logAdminAction() calls it
-- with the user's JWT (auth.uid() populated). Re-grant EXECUTE; the RPC still enforces admin via
-- check_is_admin(auth.uid()) (mig 160).

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
    AND role = 'lecturer'
    AND (
      lecturer_status = 'pending'
      OR (lecturer_status IS NULL AND is_approved IS NOT TRUE)
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
    AND role = 'lecturer'
    AND (
      lecturer_status = 'pending'
      OR (lecturer_status IS NULL AND is_approved IS NOT TRUE)
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending lecturer profile not found for user %', p_user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_audit_log(uuid, text, text, text, jsonb, text) TO authenticated;

COMMIT;
