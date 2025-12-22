-- Migration: Update approve_enrollment_request to use check_is_admin
-- Description: Use the check_is_admin RPC function for consistency and to bypass RLS issues

CREATE OR REPLACE FUNCTION public.approve_enrollment_request(request_id UUID)
RETURNS void AS $$
DECLARE
  request_record public.enrollment_requests%ROWTYPE;
  admin_user_id UUID;
  is_admin BOOLEAN;
BEGIN
  -- Check if user is admin using the RPC function (bypasses RLS)
  SELECT public.check_is_admin(auth.uid()) INTO is_admin;
  
  IF NOT is_admin THEN
    RAISE EXCEPTION 'Only admins can approve enrollment requests';
  END IF;
  
  -- Get admin user ID for reviewed_by field
  admin_user_id := auth.uid();
  
  -- Get the enrollment request (bypass RLS by using SECURITY DEFINER)
  SELECT * INTO request_record
  FROM public.enrollment_requests
  WHERE id = request_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment request not found or already processed';
  END IF;
  
  -- Update request status
  UPDATE public.enrollment_requests
  SET 
    status = 'approved',
    reviewed_by = admin_user_id,
    reviewed_at = TIMEZONE('utc', NOW()),
    updated_at = TIMEZONE('utc', NOW())
  WHERE id = request_id;
  
  -- Insert into enrollments (or update if exists)
  INSERT INTO public.enrollments (user_id, course_id)
  VALUES (request_record.user_id, request_record.course_id)
  ON CONFLICT (user_id, course_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

COMMENT ON FUNCTION public.approve_enrollment_request IS 'Approves an enrollment request and creates the enrollment';








