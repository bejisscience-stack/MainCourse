-- Migration: Create RPC function to fetch bundle enrollment requests for admins
-- Description: Bypasses RLS to ensure admins can always view all bundle enrollment requests
-- This fixes an issue where pending bundle enrollment requests were not showing on admin dashboard

DROP FUNCTION IF EXISTS public.get_bundle_enrollment_requests_admin(TEXT);

CREATE OR REPLACE FUNCTION public.get_bundle_enrollment_requests_admin(filter_status TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  bundle_id UUID,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  payment_screenshots TEXT[]
) AS $$
BEGIN
  -- Verify caller is admin using the check_is_admin function
  IF NOT public.check_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can access bundle enrollment requests';
  END IF;

  -- Return all or filtered results based on status parameter
  IF filter_status IS NULL OR filter_status = '' OR filter_status = 'all' THEN
    RETURN QUERY
    SELECT
      ber.id,
      ber.user_id,
      ber.bundle_id,
      ber.status,
      ber.created_at,
      ber.updated_at,
      ber.reviewed_by,
      ber.reviewed_at,
      COALESCE(ber.payment_screenshots, '{}')
    FROM public.bundle_enrollment_requests ber
    ORDER BY ber.created_at DESC;
  ELSE
    RETURN QUERY
    SELECT
      ber.id,
      ber.user_id,
      ber.bundle_id,
      ber.status,
      ber.created_at,
      ber.updated_at,
      ber.reviewed_by,
      ber.reviewed_at,
      COALESCE(ber.payment_screenshots, '{}')
    FROM public.bundle_enrollment_requests ber
    WHERE ber.status = filter_status
    ORDER BY ber.created_at DESC;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE
SET search_path = public;

COMMENT ON FUNCTION public.get_bundle_enrollment_requests_admin IS 'Fetches ALL bundle enrollment requests for admins, bypasses RLS via SECURITY DEFINER. Orders by created_at DESC.';
