-- Migration: Update approve enrollment request to distribute commissions
-- Description: When enrollment is approved, distribute course price between referrer and lecturer

-- Step 1: Create new function that handles commission distribution
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Create function to approve withdrawal request
-- ============================================
CREATE OR REPLACE FUNCTION public.approve_withdrawal_request(p_request_id UUID, p_admin_notes TEXT DEFAULT NULL)
RETURNS void AS $$
DECLARE
  v_admin_id UUID;
  v_request public.withdrawal_requests%ROWTYPE;
  v_current_balance DECIMAL(10, 2);
BEGIN
  -- Verify admin
  SELECT id INTO v_admin_id
  FROM public.profiles
  WHERE id = auth.uid() AND role = 'admin';
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can approve withdrawal requests';
  END IF;
  
  -- Get the withdrawal request
  SELECT * INTO v_request
  FROM public.withdrawal_requests
  WHERE id = p_request_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal request not found or already processed';
  END IF;
  
  -- Get current balance
  SELECT balance INTO v_current_balance
  FROM public.profiles
  WHERE id = v_request.user_id;
  
  IF v_current_balance < v_request.amount THEN
    RAISE EXCEPTION 'Insufficient balance. Current balance: %, Requested: %', v_current_balance, v_request.amount;
  END IF;
  
  -- Debit the user's balance
  PERFORM public.debit_user_balance(
    v_request.user_id,
    v_request.amount,
    'withdrawal',
    p_request_id,
    'withdrawal_request',
    'Withdrawal approved'
  );
  
  -- Update withdrawal request status
  UPDATE public.withdrawal_requests
  SET 
    status = 'completed',
    admin_notes = COALESCE(p_admin_notes, admin_notes),
    processed_at = TIMEZONE('utc', NOW()),
    processed_by = v_admin_id,
    updated_at = TIMEZONE('utc', NOW())
  WHERE id = p_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create function to reject withdrawal request
-- ============================================
CREATE OR REPLACE FUNCTION public.reject_withdrawal_request(p_request_id UUID, p_admin_notes TEXT DEFAULT NULL)
RETURNS void AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  -- Verify admin
  SELECT id INTO v_admin_id
  FROM public.profiles
  WHERE id = auth.uid() AND role = 'admin';
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can reject withdrawal requests';
  END IF;
  
  -- Update withdrawal request status
  UPDATE public.withdrawal_requests
  SET 
    status = 'rejected',
    admin_notes = COALESCE(p_admin_notes, 'Withdrawal request rejected'),
    processed_at = TIMEZONE('utc', NOW()),
    processed_by = v_admin_id,
    updated_at = TIMEZONE('utc', NOW())
  WHERE id = p_request_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal request not found or already processed';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create function to create withdrawal request
-- ============================================
CREATE OR REPLACE FUNCTION public.create_withdrawal_request(
  p_amount DECIMAL(10, 2),
  p_bank_account_number TEXT
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_user_type TEXT;
  v_current_balance DECIMAL(10, 2);
  v_pending_withdrawal DECIMAL(10, 2);
  v_request_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  -- Get user type and balance
  SELECT role, balance INTO v_user_type, v_current_balance
  FROM public.profiles
  WHERE id = v_user_id;
  
  IF v_user_type IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;
  
  IF v_user_type = 'admin' THEN
    RAISE EXCEPTION 'Admins cannot request withdrawals';
  END IF;
  
  -- Validate amount
  IF p_amount < 20.00 THEN
    RAISE EXCEPTION 'Minimum withdrawal amount is 20 GEL';
  END IF;
  
  -- Check if user has pending withdrawal
  SELECT COALESCE(SUM(amount), 0) INTO v_pending_withdrawal
  FROM public.withdrawal_requests
  WHERE user_id = v_user_id AND status = 'pending';
  
  IF v_pending_withdrawal > 0 THEN
    RAISE EXCEPTION 'You already have a pending withdrawal request';
  END IF;
  
  -- Check sufficient balance
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance. Current balance: %', v_current_balance;
  END IF;
  
  -- Validate bank account
  IF p_bank_account_number IS NULL OR LENGTH(TRIM(p_bank_account_number)) < 10 THEN
    RAISE EXCEPTION 'Invalid bank account number';
  END IF;
  
  -- Create withdrawal request
  INSERT INTO public.withdrawal_requests (
    user_id,
    user_type,
    amount,
    bank_account_number,
    status
  )
  VALUES (
    v_user_id,
    v_user_type,
    p_amount,
    TRIM(p_bank_account_number),
    'pending'
  )
  RETURNING id INTO v_request_id;
  
  -- Update user's bank account number in profile
  UPDATE public.profiles
  SET bank_account_number = TRIM(p_bank_account_number)
  WHERE id = v_user_id;
  
  RETURN v_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

