Fix 2 issues by creating Supabase migrations ONLY. Do not touch any TypeScript files.

FIX 1 — HIGH — Restrict insert_audit_log RPC to admins (BIZ-02):
- Create a new migration file in supabase/migrations/
- DROP and recreate the insert_audit_log function with admin verification
- The function must check that auth.uid() exists in profiles with role = 'admin'
- Force admin_user_id to be auth.uid() instead of accepting it as parameter (prevents impersonation)
- Pattern:
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
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
      RAISE EXCEPTION 'Only admins can write to audit log';
    END IF;
    INSERT INTO audit_log (admin_user_id, action, target_table, target_id, metadata, ip_address)
    VALUES (auth.uid(), p_action, p_target_table, p_target_id, p_metadata, p_ip_address);
  END;
  $$;

FIX 2 — MEDIUM — Stop leaking SQLERRM in complete_keepz_payment (DATA-02):
- Create a new migration file in supabase/migrations/
- ALTER the complete_keepz_payment function's EXCEPTION handler
- Replace: RETURN jsonb_build_object('success', false, 'error', SQLERRM);
- With:
  RAISE WARNING 'complete_keepz_payment error for order %: %', p_keepz_order_id, SQLERRM;
  RETURN jsonb_build_object('success', false, 'error', 'Payment processing failed');
- IMPORTANT: You need to recreate the full function. Read the latest version from migration 112_keepz_bundle_support.sql and only change the EXCEPTION handler. Keep all other logic identical.

Run npm run build. Commit with message "security: restrict audit log RPC to admins, redact SQLERRM (BIZ-02, DATA-02)"
Output <promise>DONE</promise> when build passes.
