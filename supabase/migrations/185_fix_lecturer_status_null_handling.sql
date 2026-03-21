-- Migration 185: Fix lecturer approval system to handle NULL lecturer_status
-- Problem: Lecturers created outside the signup trigger (e.g. manual role change)
-- have role='lecturer' but lecturer_status=NULL, making them invisible to the
-- get_pending_lecturers RPC and unapprove/rejectable by approve/reject RPCs.

BEGIN;

-- 1. Update get_pending_lecturers to also return lecturers with NULL lecturer_status
CREATE OR REPLACE FUNCTION public.get_pending_lecturers()
RETURNS TABLE(
  id uuid,
  email text,
  full_name text,
  username text,
  is_approved boolean,
  lecturer_status text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.check_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can view pending lecturers';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    COALESCE(public.decrypt_pii(p.encrypted_email), p.email) AS email,
    COALESCE(public.decrypt_pii(p.encrypted_full_name), p.full_name) AS full_name,
    p.username,
    p.is_approved,
    -- Map NULL lecturer_status based on is_approved for legacy/manual lecturers
    COALESCE(
      p.lecturer_status,
      CASE WHEN p.is_approved THEN 'approved' ELSE 'pending' END
    ) AS lecturer_status,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  WHERE p.lecturer_status IS NOT NULL
     OR p.role = 'lecturer'
  ORDER BY p.created_at DESC;
END;
$$;

-- 2. Update approve_lecturer_account to also match NULL lecturer_status
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
  SET role = 'lecturer', is_approved = true, lecturer_status = 'approved', updated_at = NOW()
  WHERE id = p_user_id
    AND (
      lecturer_status = 'pending'
      OR (lecturer_status IS NULL AND role = 'lecturer' AND is_approved = false)
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending lecturer profile not found for user %', p_user_id;
  END IF;
END;
$$;

-- 3. Update reject_lecturer_account to also match NULL lecturer_status
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
  SET is_approved = false, lecturer_status = 'rejected', updated_at = NOW()
  WHERE id = p_user_id
    AND (
      lecturer_status = 'pending'
      OR (lecturer_status IS NULL AND role = 'lecturer' AND is_approved = false)
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending lecturer profile not found for user %', p_user_id;
  END IF;
END;
$$;

COMMIT;
