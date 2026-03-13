-- BIZ-02: Restrict insert_audit_log RPC to admins and force auth.uid()
-- Previously any caller could invoke this SECURITY DEFINER function
-- and spoof the admin_user_id parameter.

DROP FUNCTION IF EXISTS insert_audit_log(UUID, TEXT, TEXT, TEXT, JSONB, TEXT);

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
  -- Verify caller is an admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can write to audit log';
  END IF;

  -- Ignore p_admin_user_id — use auth.uid() to prevent impersonation
  INSERT INTO audit_log (admin_user_id, action, target_table, target_id, metadata, ip_address)
  VALUES (auth.uid(), p_action, p_target_table, p_target_id, p_metadata, p_ip_address);
END;
$$;
