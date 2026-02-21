-- Migration: Fix bundle enrollment requests RLS policy for UPDATE
-- Description: Adds WITH CHECK clause to allow admins to update bundle enrollment request status
-- Also fixes the UNIQUE constraint that might be preventing status updates

-- Drop the problematic UNIQUE constraint that includes status
-- This constraint prevents updating status from 'pending' to 'approved'
-- PostgreSQL auto-generates constraint names, so we need to find and drop it
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find the constraint name
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.bundle_enrollment_requests'::regclass
    AND contype = 'u'
    AND array_length(conkey, 1) = 3; -- Three columns in the constraint
    
    -- Drop it if found
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.bundle_enrollment_requests DROP CONSTRAINT IF EXISTS %I', constraint_name);
    END IF;
END $$;

-- The partial unique index for pending requests is sufficient to prevent duplicate pending requests
-- We don't need the full UNIQUE constraint that includes status

-- Drop existing policy
DROP POLICY IF EXISTS "Admins can update bundle enrollment requests" ON public.bundle_enrollment_requests;

-- Recreate policy with both USING and WITH CHECK clauses
CREATE POLICY "Admins can update bundle enrollment requests"
  ON public.bundle_enrollment_requests FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Also update the approve function to ensure the UPDATE succeeds and raise an error if it doesn't
CREATE OR REPLACE FUNCTION public.approve_bundle_enrollment_request(request_id UUID)
RETURNS void AS $$
DECLARE
  request_record public.bundle_enrollment_requests%ROWTYPE;
  bundle_course RECORD;
  update_count INTEGER;
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can approve bundle enrollment requests';
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
    reviewed_by = auth.uid(),
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

COMMENT ON FUNCTION public.approve_bundle_enrollment_request IS 'Approves a bundle enrollment request and creates enrollments for all courses in the bundle';

