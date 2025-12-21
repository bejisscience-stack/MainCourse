-- Migration: Create RPC function to fetch enrollment requests for admins
-- Description: Bypasses RLS to ensure admins can always view all enrollment requests

-- Create function to get enrollment requests (admin only, bypasses RLS)
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
  -- Using SECURITY DEFINER means this runs as the function owner (postgres), bypassing RLS
  IF filter_status IS NULL OR filter_status = '' THEN
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

COMMENT ON FUNCTION public.get_enrollment_requests_admin IS 'Fetches enrollment requests for admins, bypasses RLS policies';






