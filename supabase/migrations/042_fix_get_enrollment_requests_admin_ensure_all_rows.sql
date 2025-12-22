-- Migration: Fix get_enrollment_requests_admin to ensure all rows are returned
-- Description: Ensures the function returns all enrollment requests without any filtering issues
-- Changed from STABLE to VOLATILE to prevent caching issues

-- Drop and recreate the function to ensure it works correctly
DROP FUNCTION IF EXISTS public.get_enrollment_requests_admin(TEXT);

CREATE OR REPLACE FUNCTION public.get_enrollment_requests_admin(filter_status TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  course_id UUID,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  payment_screenshots JSONB
) AS $$
BEGIN
  -- Check if the current user is an admin
  IF NOT public.check_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can access enrollment requests';
  END IF;

  -- Return enrollment requests with optional status filter
  -- Using SECURITY DEFINER means this runs as the function owner (postgres), bypassing RLS completely
  -- Using VOLATILE instead of STABLE to ensure fresh data (no caching)
  IF filter_status IS NULL OR filter_status = '' OR filter_status = 'all' THEN
    -- Return ALL enrollment requests
    RETURN QUERY
    SELECT 
      er.id,
      er.user_id,
      er.course_id,
      er.status,
      er.created_at,
      er.updated_at,
      er.reviewed_by,
      er.reviewed_at,
      COALESCE(er.payment_screenshots, '[]'::jsonb) as payment_screenshots
    FROM public.enrollment_requests er
    ORDER BY er.created_at DESC;
  ELSE
    -- Return filtered enrollment requests
    RETURN QUERY
    SELECT 
      er.id,
      er.user_id,
      er.course_id,
      er.status,
      er.created_at,
      er.updated_at,
      er.reviewed_by,
      er.reviewed_at,
      COALESCE(er.payment_screenshots, '[]'::jsonb) as payment_screenshots
    FROM public.enrollment_requests er
    WHERE er.status = filter_status
    ORDER BY er.created_at DESC;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE
SET search_path = public;

COMMENT ON FUNCTION public.get_enrollment_requests_admin IS 'Fetches enrollment requests for admins, bypasses RLS policies. Returns ALL requests when filter_status is NULL, empty, or "all". Uses VOLATILE to prevent caching.';







