-- Migration: Fix approve_enrollment_request to use check_is_admin
-- Description: Update the admin check to use check_is_admin RPC function for consistency with reject_enrollment_request

CREATE OR REPLACE FUNCTION public.approve_enrollment_request(request_id UUID)
RETURNS void AS $$
DECLARE
  request_record public.enrollment_requests%ROWTYPE;
  admin_user_id UUID;
  is_admin BOOLEAN;
  v_course_price DECIMAL(10, 2);
  v_commission_percentage INTEGER;
  v_student_commission DECIMAL(10, 2);
  v_lecturer_earnings DECIMAL(10, 2);
  v_referral_code TEXT;
  v_referrer_id UUID;
  v_lecturer_id UUID;
BEGIN
  -- Check if user is admin using the RPC function (bypasses RLS) - consistent with reject_enrollment_request
  SELECT public.check_is_admin(auth.uid()) INTO is_admin;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Only admins can approve enrollment requests';
  END IF;

  -- Get admin user ID for reviewed_by field
  admin_user_id := auth.uid();

  -- Get the enrollment request
  SELECT * INTO request_record
  FROM public.enrollment_requests
  WHERE id = request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment request not found or already processed';
  END IF;

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

  -- Insert into enrollments (or update if exists)
  INSERT INTO public.enrollments (user_id, course_id, approved_at)
  VALUES (request_record.user_id, request_record.course_id, TIMEZONE('utc', NOW()))
  ON CONFLICT (user_id, course_id) DO UPDATE
  SET approved_at = TIMEZONE('utc', NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

COMMENT ON FUNCTION public.approve_enrollment_request IS 'Approves an enrollment request, creates enrollment, and distributes commissions. Uses check_is_admin for admin verification.';
