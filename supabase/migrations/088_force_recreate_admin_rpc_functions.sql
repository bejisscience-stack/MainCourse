-- Migration: Force recreate ALL admin request RPC functions
-- Description: This migration forcefully drops and recreates all admin RPC functions
-- to fix an issue where pending requests were not being returned to the admin dashboard.
-- The root cause was likely a schema mismatch or corrupted function definition in production.

-- ============================================
-- PART 1: DROP ALL EXISTING FUNCTIONS
-- ============================================
-- Drop with explicit signature to ensure we remove the exact function version

DROP FUNCTION IF EXISTS public.get_enrollment_requests_admin(TEXT);
DROP FUNCTION IF EXISTS public.get_bundle_enrollment_requests_admin(TEXT);
DROP FUNCTION IF EXISTS public.get_withdrawal_requests_admin(TEXT);

-- ============================================
-- PART 2: ENROLLMENT REQUESTS FUNCTION
-- ============================================

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
  payment_screenshots JSONB,
  referral_code TEXT
) AS $$
BEGIN
  -- Verify caller is admin using the check_is_admin function
  IF NOT public.check_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can access enrollment requests';
  END IF;

  -- Return all or filtered results based on status parameter
  IF filter_status IS NULL OR filter_status = '' OR filter_status = 'all' THEN
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
      COALESCE(er.payment_screenshots, '[]'::jsonb),
      er.referral_code
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
      COALESCE(er.payment_screenshots, '[]'::jsonb),
      er.referral_code
    FROM public.enrollment_requests er
    WHERE er.status = filter_status
    ORDER BY er.created_at DESC;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE
SET search_path = public;

COMMENT ON FUNCTION public.get_enrollment_requests_admin IS 'Fetches ALL enrollment requests for admins, bypasses RLS via SECURITY DEFINER. Returns all records when filter_status is NULL/empty/all.';

-- ============================================
-- PART 3: BUNDLE ENROLLMENT REQUESTS FUNCTION
-- ============================================

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

COMMENT ON FUNCTION public.get_bundle_enrollment_requests_admin IS 'Fetches ALL bundle enrollment requests for admins, bypasses RLS via SECURITY DEFINER.';

-- ============================================
-- PART 4: WITHDRAWAL REQUESTS FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION public.get_withdrawal_requests_admin(filter_status TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_type TEXT,
  amount DECIMAL(10, 2),
  bank_account_number TEXT,
  status TEXT,
  admin_notes TEXT,
  processed_at TIMESTAMPTZ,
  processed_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Verify caller is admin using the check_is_admin function
  IF NOT public.check_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can access withdrawal requests';
  END IF;

  -- Return all or filtered results based on status parameter
  IF filter_status IS NULL OR filter_status = '' OR filter_status = 'all' THEN
    RETURN QUERY
    SELECT
      wr.id,
      wr.user_id,
      wr.user_type,
      wr.amount,
      wr.bank_account_number,
      wr.status,
      wr.admin_notes,
      wr.processed_at,
      wr.processed_by,
      wr.created_at,
      wr.updated_at
    FROM public.withdrawal_requests wr
    ORDER BY wr.created_at DESC;
  ELSE
    RETURN QUERY
    SELECT
      wr.id,
      wr.user_id,
      wr.user_type,
      wr.amount,
      wr.bank_account_number,
      wr.status,
      wr.admin_notes,
      wr.processed_at,
      wr.processed_by,
      wr.created_at,
      wr.updated_at
    FROM public.withdrawal_requests wr
    WHERE wr.status = filter_status
    ORDER BY wr.created_at DESC;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE
SET search_path = public;

COMMENT ON FUNCTION public.get_withdrawal_requests_admin IS 'Fetches ALL withdrawal requests for admins, bypasses RLS via SECURITY DEFINER.';

-- ============================================
-- PART 5: VERIFY check_is_admin FUNCTION EXISTS
-- ============================================
-- This function must exist for the above functions to work

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'check_is_admin'
  ) THEN
    RAISE NOTICE 'Creating check_is_admin function...';
    EXECUTE '
      CREATE OR REPLACE FUNCTION public.check_is_admin(user_id UUID)
      RETURNS BOOLEAN AS $func$
      DECLARE
        user_role TEXT;
      BEGIN
        SELECT role INTO user_role FROM public.profiles WHERE id = user_id;
        RETURN COALESCE(user_role, '''') = ''admin'';
      END;
      $func$ LANGUAGE plpgsql SECURITY DEFINER STABLE
      SET search_path = public;
    ';
  END IF;
END $$;
