-- Migration: Create SECURITY DEFINER RPC functions for admin data fetching
-- Description: Ensures admins can reliably fetch ALL enrollment and withdrawal requests
-- This fixes an issue where service role queries were not returning all records

-- Part 1: Update get_enrollment_requests_admin to include referral_code field
-- The previous version was missing referral_code which was added in migration 064
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
    ORDER BY er.updated_at DESC;
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
    ORDER BY er.updated_at DESC;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE
SET search_path = public;

-- Part 2: Create get_withdrawal_requests_admin function (NEW)
-- This function allows admins to fetch ALL withdrawal requests bypassing RLS
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

-- Add helpful comments
COMMENT ON FUNCTION public.get_enrollment_requests_admin IS 'Fetches ALL enrollment requests for admins, bypasses RLS via SECURITY DEFINER. Includes referral_code field.';
COMMENT ON FUNCTION public.get_withdrawal_requests_admin IS 'Fetches ALL withdrawal requests for admins, bypasses RLS via SECURITY DEFINER.';
