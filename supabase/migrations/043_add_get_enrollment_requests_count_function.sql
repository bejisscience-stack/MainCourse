-- Migration: Add helper function to get enrollment request counts
-- Description: Provides a way to verify total counts in the database

CREATE OR REPLACE FUNCTION public.get_enrollment_requests_count()
RETURNS TABLE (
  total_count BIGINT,
  pending_count BIGINT,
  approved_count BIGINT,
  rejected_count BIGINT
) AS $$
BEGIN
  -- Check if the current user is an admin
  IF NOT public.check_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can access enrollment request counts';
  END IF;

  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_count,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT as pending_count,
    COUNT(*) FILTER (WHERE status = 'approved')::BIGINT as approved_count,
    COUNT(*) FILTER (WHERE status = 'rejected')::BIGINT as rejected_count
  FROM public.enrollment_requests;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE
SET search_path = public;

COMMENT ON FUNCTION public.get_enrollment_requests_count IS 'Returns counts of enrollment requests by status for admins';






