-- Migration 160: Fix admin ID spoofing in insert_audit_log (RLS-12)
-- Uses auth.uid() for admin identity instead of trusting the p_admin_user_id parameter.
-- Requires the caller to be authenticated (not service_role), so auth.uid() is populated.

CREATE OR REPLACE FUNCTION insert_audit_log(
  p_admin_user_id UUID,        -- kept for backward compat; IGNORED — auth.uid() is used instead
  p_action TEXT,
  p_target_table TEXT,
  p_target_id TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
BEGIN
  -- RLS-12: Use auth.uid() — not the caller-supplied p_admin_user_id
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated — auth.uid() is NULL';
  END IF;

  IF NOT public.check_is_admin(v_admin_id) THEN
    RAISE EXCEPTION 'Only admins can insert audit log entries';
  END IF;

  -- Input length validation (from migration 153)
  IF length(p_action) > 100 THEN
    RAISE EXCEPTION 'p_action exceeds maximum length of 100 characters';
  END IF;

  IF length(p_target_table) > 50 THEN
    RAISE EXCEPTION 'p_target_table exceeds maximum length of 50 characters';
  END IF;

  IF length(p_target_id) > 100 THEN
    RAISE EXCEPTION 'p_target_id exceeds maximum length of 100 characters';
  END IF;

  INSERT INTO audit_log (admin_user_id, action, target_table, target_id, metadata, ip_address)
  VALUES (v_admin_id, p_action, p_target_table, p_target_id, p_metadata, p_ip_address);
END;
$$;
