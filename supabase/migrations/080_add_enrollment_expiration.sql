-- Migration: Add enrollment expiration support
-- Description: Adds expires_at column to enrollments and updates approval functions to set 1-month expiration

-- Step 1: Add expires_at column to enrollments table
-- ============================================
ALTER TABLE public.enrollments
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Step 2: Create index for efficient expiration queries
-- ============================================
CREATE INDEX IF NOT EXISTS enrollments_expires_at_idx
ON public.enrollments(expires_at)
WHERE expires_at IS NOT NULL;

-- Create composite index for user + course + expiration lookups
CREATE INDEX IF NOT EXISTS enrollments_user_course_expires_idx
ON public.enrollments(user_id, course_id, expires_at);

-- Step 3: Backfill existing enrollments with 1 month from now
-- (gives existing users a fresh month from today)
-- ============================================
UPDATE public.enrollments
SET expires_at = TIMEZONE('utc', NOW()) + INTERVAL '1 month'
WHERE expires_at IS NULL;

-- Step 4: Update approve_enrollment_request function to set expires_at
-- ============================================
CREATE OR REPLACE FUNCTION public.approve_enrollment_request(request_id UUID)
RETURNS void AS $$
DECLARE
  request_record public.enrollment_requests%ROWTYPE;
  admin_user_id UUID;
  v_course_price DECIMAL(10, 2);
  v_commission_percentage INTEGER;
  v_student_commission DECIMAL(10, 2);
  v_lecturer_earnings DECIMAL(10, 2);
  v_referral_code TEXT;
  v_referrer_id UUID;
  v_lecturer_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Get admin user ID
  SELECT id INTO admin_user_id
  FROM public.profiles
  WHERE id = auth.uid() AND role = 'admin';

  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can approve enrollment requests';
  END IF;

  -- Get the enrollment request
  SELECT * INTO request_record
  FROM public.enrollment_requests
  WHERE id = request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment request not found or already processed';
  END IF;

  -- Calculate expiration date (1 month from now, preserving exact minute)
  v_expires_at := TIMEZONE('utc', NOW()) + INTERVAL '1 month';

  -- Get course details
  SELECT c.price, c.referral_commission_percentage, c.lecturer_id
  INTO v_course_price, v_commission_percentage, v_lecturer_id
  FROM public.courses c
  WHERE c.id = request_record.course_id;

  IF v_course_price IS NULL THEN
    RAISE EXCEPTION 'Course not found';
  END IF;

  -- Get referral code from enrollment request
  v_referral_code := request_record.referral_code;

  -- Process referral commission if referral code exists and commission percentage > 0
  IF v_referral_code IS NOT NULL AND v_referral_code != '' AND v_commission_percentage > 0 THEN
    -- Find referrer by referral code
    SELECT id INTO v_referrer_id
    FROM public.profiles
    WHERE referral_code = v_referral_code
    AND id != request_record.user_id; -- Prevent self-referral

    IF v_referrer_id IS NOT NULL THEN
      -- Calculate commissions
      v_student_commission := v_course_price * (v_commission_percentage::DECIMAL / 100);
      v_lecturer_earnings := v_course_price - v_student_commission;

      -- Credit referrer (student who referred)
      PERFORM public.credit_user_balance(
        v_referrer_id,
        v_student_commission,
        'referral_commission',
        request_id,
        'enrollment_request',
        'Referral commission for course enrollment'
      );

      -- Credit lecturer (course earnings minus commission)
      IF v_lecturer_id IS NOT NULL AND v_lecturer_earnings > 0 THEN
        PERFORM public.credit_user_balance(
          v_lecturer_id,
          v_lecturer_earnings,
          'course_purchase',
          request_id,
          'enrollment_request',
          'Course purchase earnings (after referral commission)'
        );
      END IF;
    ELSE
      -- No valid referrer found, lecturer gets 100%
      IF v_lecturer_id IS NOT NULL AND v_course_price > 0 THEN
        PERFORM public.credit_user_balance(
          v_lecturer_id,
          v_course_price,
          'course_purchase',
          request_id,
          'enrollment_request',
          'Course purchase earnings'
        );
      END IF;
    END IF;
  ELSE
    -- No referral code or 0% commission, lecturer gets 100%
    IF v_lecturer_id IS NOT NULL AND v_course_price > 0 THEN
      PERFORM public.credit_user_balance(
        v_lecturer_id,
        v_course_price,
        'course_purchase',
        request_id,
        'enrollment_request',
        'Course purchase earnings'
      );
    END IF;
  END IF;

  -- Update request status
  UPDATE public.enrollment_requests
  SET
    status = 'approved',
    reviewed_by = admin_user_id,
    reviewed_at = TIMEZONE('utc', NOW()),
    updated_at = TIMEZONE('utc', NOW())
  WHERE id = request_id;

  -- Insert into enrollments with expiration (or update if exists)
  INSERT INTO public.enrollments (user_id, course_id, approved_at, expires_at)
  VALUES (request_record.user_id, request_record.course_id, TIMEZONE('utc', NOW()), v_expires_at)
  ON CONFLICT (user_id, course_id) DO UPDATE
  SET approved_at = TIMEZONE('utc', NOW()),
      expires_at = v_expires_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Update approve_bundle_enrollment_request function to set expires_at
-- ============================================
DROP FUNCTION IF EXISTS public.approve_bundle_enrollment_request(UUID);
DROP FUNCTION IF EXISTS public.approve_bundle_enrollment_request(UUID, UUID);

CREATE OR REPLACE FUNCTION public.approve_bundle_enrollment_request(request_id UUID, admin_user_id UUID DEFAULT NULL)
RETURNS void AS $$
DECLARE
  request_record public.bundle_enrollment_requests%ROWTYPE;
  bundle_course RECORD;
  update_count INTEGER;
  actual_admin_id UUID;
  v_expires_at TIMESTAMPTZ;
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

  -- Calculate expiration date (1 month from now, preserving exact minute)
  v_expires_at := TIMEZONE('utc', NOW()) + INTERVAL '1 month';

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

  -- Create individual course enrollments for all courses in the bundle WITH expiration
  FOR bundle_course IN
    SELECT course_id FROM public.course_bundle_items
    WHERE bundle_id = request_record.bundle_id
  LOOP
    INSERT INTO public.enrollments (user_id, course_id, expires_at)
    VALUES (request_record.user_id, bundle_course.course_id, v_expires_at)
    ON CONFLICT (user_id, course_id) DO UPDATE
    SET expires_at = v_expires_at;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.approve_bundle_enrollment_request IS 'Approves a bundle enrollment request and creates enrollments for all courses in the bundle with 1-month expiration. Accepts optional admin_user_id parameter for service role calls.';

-- Step 6: Keep reject_bundle_enrollment_request unchanged (re-create to ensure consistency)
-- ============================================
DROP FUNCTION IF EXISTS public.reject_bundle_enrollment_request(UUID);
DROP FUNCTION IF EXISTS public.reject_bundle_enrollment_request(UUID, UUID);

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
