-- Migration 153: Harden insert_audit_log (SEC-20 + SEC-21)
-- Adds admin role verification and input length validation.
-- Preserves exact same signature and behavior otherwise.

CREATE OR REPLACE FUNCTION insert_audit_log(
  p_admin_user_id UUID,
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
BEGIN
  -- SEC-20: Verify caller is actually an admin
  IF NOT public.check_is_admin(p_admin_user_id) THEN
    RAISE EXCEPTION 'Only admins can insert audit log entries';
  END IF;

  -- SEC-21: Input length validation to prevent abuse
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
  VALUES (p_admin_user_id, p_action, p_target_table, p_target_id, p_metadata, p_ip_address);
END;
$$;
