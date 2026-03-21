-- Migration 184: email_send_history table + get_admin_email_list() RPC
-- Tracks per-recipient email send history for admin email management
-- Provides unified view of all platform emails (profiles + coming_soon_emails)

-- ============================================
-- PART 1: email_send_history table
-- ============================================

CREATE TABLE IF NOT EXISTS public.email_send_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  recipient_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_by UUID NOT NULL REFERENCES auth.users(id),
  source TEXT NOT NULL DEFAULT 'admin_notification',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_send_history_recipient_email ON public.email_send_history(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_send_history_recipient_user_id ON public.email_send_history(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_email_send_history_sent_at ON public.email_send_history(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_history_sent_by ON public.email_send_history(sent_by);

-- RLS
ALTER TABLE public.email_send_history ENABLE ROW LEVEL SECURITY;

-- Admins can read
CREATE POLICY "admin_select_email_send_history" ON public.email_send_history
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- No INSERT policy needed: service role bypasses RLS.
-- Any non-service-role user is denied INSERT by default.

-- ============================================
-- PART 2: get_admin_email_list() RPC
-- ============================================

CREATE OR REPLACE FUNCTION public.get_admin_email_list()
RETURNS TABLE (
  email TEXT,
  source TEXT,
  user_id UUID,
  full_name TEXT,
  username TEXT,
  role TEXT,
  is_registered BOOLEAN,
  registered_at TIMESTAMPTZ,
  has_enrollment BOOLEAN,
  enrolled_courses_count INT,
  last_email_sent_at TIMESTAMPTZ,
  total_emails_sent INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH
  -- Decrypt profile emails using LATERAL to avoid double-decryption
  profile_emails AS (
    SELECT
      LOWER(decrypted.email) AS email,
      p.id AS user_id,
      COALESCE(decrypted.full_name, p.full_name) AS full_name,
      p.username,
      p.role,
      p.created_at AS registered_at
    FROM public.profiles p,
    LATERAL (
      SELECT
        public.decrypt_pii(p.encrypted_email) AS email,
        public.decrypt_pii(p.encrypted_full_name) AS full_name
    ) decrypted
    WHERE p.encrypted_email IS NOT NULL
      AND decrypted.email LIKE '%@%'
  ),
  -- Coming soon emails (plaintext)
  cs_emails AS (
    SELECT LOWER(cs.email) AS email
    FROM public.coming_soon_emails cs
    WHERE cs.email IS NOT NULL AND cs.email LIKE '%@%'
  ),
  -- All unique emails with source classification
  all_emails AS (
    SELECT
      COALESCE(pe.email, cs.email) AS email,
      CASE
        WHEN pe.email IS NOT NULL AND cs.email IS NOT NULL THEN 'both'
        WHEN pe.email IS NOT NULL THEN 'profile'
        ELSE 'coming_soon'
      END AS source,
      pe.user_id,
      pe.full_name,
      pe.username,
      pe.role,
      pe.user_id IS NOT NULL AS is_registered,
      pe.registered_at
    FROM profile_emails pe
    FULL OUTER JOIN cs_emails cs ON pe.email = cs.email
  ),
  -- Enrollment counts per user
  enrollment_counts AS (
    SELECT
      e.user_id,
      COUNT(*)::INT AS cnt
    FROM public.enrollments e
    GROUP BY e.user_id
  ),
  -- Email send history stats
  send_stats AS (
    SELECT
      LOWER(h.recipient_email) AS email,
      MAX(h.sent_at) AS last_sent,
      COUNT(*)::INT AS total_sent
    FROM public.email_send_history h
    GROUP BY LOWER(h.recipient_email)
  )
  SELECT
    ae.email,
    ae.source,
    ae.user_id,
    ae.full_name,
    ae.username,
    ae.role,
    ae.is_registered,
    ae.registered_at,
    COALESCE(ec.cnt > 0, FALSE) AS has_enrollment,
    COALESCE(ec.cnt, 0) AS enrolled_courses_count,
    ss.last_sent AS last_email_sent_at,
    COALESCE(ss.total_sent, 0) AS total_emails_sent
  FROM all_emails ae
  LEFT JOIN enrollment_counts ec ON ae.user_id = ec.user_id
  LEFT JOIN send_stats ss ON ae.email = ss.email
  ORDER BY ae.email;
END;
$$;

-- Only service_role can execute this function (PII decryption)
REVOKE EXECUTE ON FUNCTION public.get_admin_email_list() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_admin_email_list() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_admin_email_list() FROM anon;
