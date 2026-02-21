-- Migration: Update bundle enrollment request functions to accept admin_user_id parameter
-- Description: Allows these functions to work with service role client by accepting admin user ID as parameter

-- Drop all existing versions of these functions to avoid ambiguity
-- We need to drop all possible signatures
DROP FUNCTION IF EXISTS public.approve_bundle_enrollment_request(UUID);
DROP FUNCTION IF EXISTS public.approve_bundle_enrollment_request(UUID, UUID);
DROP FUNCTION IF EXISTS public.reject_bundle_enrollment_request(UUID);
DROP FUNCTION IF EXISTS public.reject_bundle_enrollment_request(UUID, UUID);

-- Create approve function with admin_user_id parameter
CREATE OR REPLACE FUNCTION public.approve_bundle_enrollment_request(request_id UUID, admin_user_id UUID DEFAULT NULL)
RETURNS void AS $$
DECLARE
  request_record public.bundle_enrollment_requests%ROWTYPE;
  bundle_course RECORD;
  update_count INTEGER;
  actual_admin_id UUID;
BEGIN
  -- Determine admin user ID: use parameter if provided, otherwise use auth.uid()
  actual_admin_id := COALESCE(admin_user_id, auth.uid());
  
  -- Check if user is admin (skip check if admin_user_id is provided, meaning it's called via service role)
  IF admin_user_id IS NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = actual_admin_id
      AND profiles.role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Only admins can approve bundle enrollment requests';
    END IF;
  ELSE
    -- When called via service role, verify the provided admin_user_id is actually an admin
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = actual_admin_id
      AND profiles.role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Provided user ID is not an admin';
    END IF;
  END IF;

  -- Get the bundle enrollment request
  SELECT * INTO request_record
  FROM public.bundle_enrollment_requests
  WHERE id = request_id;

  IF NOT FOUND OR request_record.status != 'pending' THEN
    RAISE EXCEPTION 'Bundle enrollment request not found or already processed';
  END IF;

  -- Update request status - use GET DIAGNOSTICS to check if update succeeded
  UPDATE public.bundle_enrollment_requests
  SET 
    status = 'approved',
    reviewed_by = actual_admin_id,
    reviewed_at = TIMEZONE('utc', NOW())
  WHERE id = request_id;
  
  GET DIAGNOSTICS update_count = ROW_COUNT;
  
  IF update_count = 0 THEN
    RAISE EXCEPTION 'Failed to update bundle enrollment request status';
  END IF;

  -- Create bundle enrollment
  INSERT INTO public.bundle_enrollments (user_id, bundle_id)
  VALUES (request_record.user_id, request_record.bundle_id)
  ON CONFLICT (user_id, bundle_id) DO NOTHING;

  -- Create individual course enrollments for all courses in the bundle
  FOR bundle_course IN
    SELECT course_id FROM public.course_bundle_items
    WHERE bundle_id = request_record.bundle_id
  LOOP
    INSERT INTO public.enrollments (user_id, course_id)
    VALUES (request_record.user_id, bundle_course.course_id)
    ON CONFLICT (user_id, course_id) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.approve_bundle_enrollment_request IS 'Approves a bundle enrollment request and creates enrollments for all courses in the bundle. Accepts optional admin_user_id parameter for service role calls.';

-- Update reject function to accept admin_user_id parameter
CREATE OR REPLACE FUNCTION public.reject_bundle_enrollment_request(request_id UUID, admin_user_id UUID DEFAULT NULL)
RETURNS void AS $$
DECLARE
  request_record public.bundle_enrollment_requests%ROWTYPE;
  actual_admin_id UUID;
BEGIN
  -- Determine admin user ID: use parameter if provided, otherwise use auth.uid()
  actual_admin_id := COALESCE(admin_user_id, auth.uid());
  
  -- Check if user is admin (skip check if admin_user_id is provided, meaning it's called via service role)
  IF admin_user_id IS NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = actual_admin_id
      AND profiles.role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Only admins can reject bundle enrollment requests';
    END IF;
  ELSE
    -- When called via service role, verify the provided admin_user_id is actually an admin
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = actual_admin_id
      AND profiles.role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Provided user ID is not an admin';
    END IF;
  END IF;

  -- Get the bundle enrollment request
  SELECT * INTO request_record
  FROM public.bundle_enrollment_requests
  WHERE id = request_id;

  IF NOT FOUND OR request_record.status != 'pending' THEN
    RAISE EXCEPTION 'Bundle enrollment request not found or already processed';
  END IF;

  -- Update request status
  UPDATE public.bundle_enrollment_requests
  SET 
    status = 'rejected',
    reviewed_by = actual_admin_id,
    reviewed_at = TIMEZONE('utc', NOW())
  WHERE id = request_id;

  -- Remove bundle enrollment if it exists
  DELETE FROM public.bundle_enrollments
  WHERE user_id = request_record.user_id
  AND bundle_id = request_record.bundle_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.reject_bundle_enrollment_request IS 'Rejects a bundle enrollment request and removes the bundle enrollment if it exists. Accepts optional admin_user_id parameter for service role calls.';

