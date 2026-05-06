-- Allow user_id anonymization on financial rows (preserve audit trail
-- after self-deletion) and let audit_log entries survive the auth user
-- they reference (tombstone semantics for GDPR-erasure self-deletions).

-- 1. keepz_payments.user_id: required NULLABLE so we can anonymize.
--    payment_audit_log.user_id is already NULLABLE (verified in staging).
ALTER TABLE public.keepz_payments
  ALTER COLUMN user_id DROP NOT NULL;

-- 2. audit_log: relax admin_user_id so a self-deletion audit row
--    survives the auth.users row it references.
ALTER TABLE public.audit_log
  ALTER COLUMN admin_user_id DROP NOT NULL;

ALTER TABLE public.audit_log
  DROP CONSTRAINT audit_log_admin_user_id_fkey;

ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_admin_user_id_fkey
    FOREIGN KEY (admin_user_id) REFERENCES auth.users(id)
    ON DELETE SET NULL;
