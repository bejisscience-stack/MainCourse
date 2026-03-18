-- Migration 165: Decrypt PII in admin lecturer RPC
--
-- The get_pending_lecturers() RPC reads p.email and p.full_name directly,
-- but the auto_encrypt_pii trigger nulls these columns after encryption.
-- Fix: use decrypt_pii() to return decrypted email/full_name to admin.

CREATE OR REPLACE FUNCTION public.get_pending_lecturers()
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  username TEXT,
  is_approved BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Verify caller is admin
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
    p.created_at,
    p.updated_at
  FROM public.profiles p
  WHERE p.role = 'lecturer'
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE;
