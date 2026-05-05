-- Migration 216: KYC RPC functions
--
-- create_kyc_submission     — user submits documents for review
-- approve_kyc_submission    — admin approves
-- reject_kyc_submission     — admin rejects with required reason
-- get_kyc_submissions_admin — admin queue listing (joined with profile data at API layer)
--
-- All functions are SECURITY DEFINER (run as postgres) so they bypass RLS for the
-- trigger and admin transitions, while the function bodies enforce their own auth
-- checks via auth.uid() — same pattern as migration 162.

-- ============================================
-- PART 1: create_kyc_submission
-- ============================================

CREATE OR REPLACE FUNCTION public.create_kyc_submission(
  p_doc_type        TEXT,
  p_doc_front_path  TEXT,
  p_doc_back_path   TEXT,
  p_selfie_path     TEXT,
  p_phone           TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id            UUID;
  v_current_status     TEXT;
  v_submission_id      UUID;
  v_normalized_phone   TEXT;
  -- Strict per-field path patterns. Mirrors isValidKycPath in
  -- app/api/kyc/submit/route.ts so a direct supabase.rpc() bypass of the API
  -- gets the same shape enforcement:
  --   first segment   = auth.uid()
  --   middle segment  = [A-Za-z0-9_-]+   (no '..', no '%', no '\\', no dots)
  --   last segment    = exact filename per field, lowercase alnum extension
  --   exactly three segments, no leading slash
  v_pattern_front      TEXT;
  v_pattern_back       TEXT;
  v_pattern_selfie     TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate doc_type
  IF p_doc_type NOT IN ('id_card', 'passport', 'drivers_license') THEN
    RAISE EXCEPTION 'Invalid document type';
  END IF;

  v_pattern_front  := '^' || v_user_id::text || '/[A-Za-z0-9_-]+/front\.[a-z0-9]+$';
  v_pattern_back   := '^' || v_user_id::text || '/[A-Za-z0-9_-]+/back\.[a-z0-9]+$';
  v_pattern_selfie := '^' || v_user_id::text || '/[A-Za-z0-9_-]+/selfie\.[a-z0-9]+$';

  IF p_doc_front_path IS NULL OR p_doc_front_path !~ v_pattern_front THEN
    RAISE EXCEPTION 'Invalid document front path';
  END IF;

  IF p_selfie_path IS NULL OR p_selfie_path !~ v_pattern_selfie THEN
    RAISE EXCEPTION 'Invalid selfie path';
  END IF;

  -- Back side required for ID card and driver's license; passport is single-sided
  IF p_doc_type <> 'passport' THEN
    IF p_doc_back_path IS NULL OR p_doc_back_path !~ v_pattern_back THEN
      RAISE EXCEPTION 'Invalid document back path';
    END IF;
  ELSE
    -- Passport: explicitly disallow back path being supplied to avoid stale uploads
    IF p_doc_back_path IS NOT NULL AND LENGTH(TRIM(p_doc_back_path)) > 0 THEN
      RAISE EXCEPTION 'Passport submissions must not include a back-side path';
    END IF;
  END IF;

  -- Validate phone — Georgian mobile format +995XXXXXXXXX (9 digits after country code)
  v_normalized_phone := REGEXP_REPLACE(COALESCE(p_phone, ''), '[\s\-]', '', 'g');
  IF v_normalized_phone !~ '^\+995\d{9}$' THEN
    RAISE EXCEPTION 'Invalid phone number format. Expected +995 followed by 9 digits.';
  END IF;

  -- Check current KYC status — only allow submission from not_submitted or rejected
  SELECT kyc_status INTO v_current_status
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF v_current_status = 'verified' THEN
    RAISE EXCEPTION 'KYC already verified';
  END IF;

  IF v_current_status = 'pending' THEN
    RAISE EXCEPTION 'KYC submission already pending review';
  END IF;

  -- Insert; partial unique index on (user_id) WHERE status='pending' is the final guard
  -- against the read-then-INSERT race (two simultaneous tabs).
  BEGIN
    INSERT INTO public.kyc_submissions (
      user_id, doc_type, doc_front_path, doc_back_path, selfie_path, phone, status
    )
    VALUES (
      v_user_id, p_doc_type, p_doc_front_path, p_doc_back_path, p_selfie_path,
      v_normalized_phone, 'pending'
    )
    RETURNING id INTO v_submission_id;
  EXCEPTION
    WHEN unique_violation THEN
      -- Lost the race against another concurrent submit from the same user.
      RAISE EXCEPTION 'KYC submission already pending review';
  END;

  -- sync_profile_kyc_status trigger flips profiles.kyc_status to 'pending'

  RETURN v_submission_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_kyc_submission(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================
-- PART 2: approve_kyc_submission
-- ============================================

CREATE OR REPLACE FUNCTION public.approve_kyc_submission(
  p_submission_id UUID,
  p_admin_notes   TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id    UUID;
  v_submission  public.kyc_submissions%ROWTYPE;
BEGIN
  -- Verify admin (matches migration 162's pattern)
  SELECT id INTO v_admin_id
  FROM public.profiles
  WHERE id = auth.uid() AND role = 'admin';

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can approve KYC submissions';
  END IF;

  -- Lock the row to prevent concurrent approve/reject
  SELECT * INTO v_submission
  FROM public.kyc_submissions
  WHERE id = p_submission_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'KYC submission not found or already processed';
  END IF;

  UPDATE public.kyc_submissions
  SET
    status      = 'verified',
    admin_notes = p_admin_notes,
    reviewed_by = v_admin_id,
    reviewed_at = TIMEZONE('utc', NOW()),
    updated_at  = TIMEZONE('utc', NOW())
  WHERE id = p_submission_id;

  -- sync_profile_kyc_status trigger flips profiles.kyc_status to 'verified'
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_kyc_submission(UUID, TEXT) TO authenticated;

-- ============================================
-- PART 3: reject_kyc_submission
-- ============================================

CREATE OR REPLACE FUNCTION public.reject_kyc_submission(
  p_submission_id UUID,
  p_admin_notes   TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id    UUID;
  v_submission  public.kyc_submissions%ROWTYPE;
BEGIN
  SELECT id INTO v_admin_id
  FROM public.profiles
  WHERE id = auth.uid() AND role = 'admin';

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can reject KYC submissions';
  END IF;

  IF p_admin_notes IS NULL OR LENGTH(TRIM(p_admin_notes)) = 0 THEN
    RAISE EXCEPTION 'Rejection reason is required';
  END IF;

  SELECT * INTO v_submission
  FROM public.kyc_submissions
  WHERE id = p_submission_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'KYC submission not found or already processed';
  END IF;

  UPDATE public.kyc_submissions
  SET
    status      = 'rejected',
    admin_notes = p_admin_notes,
    reviewed_by = v_admin_id,
    reviewed_at = TIMEZONE('utc', NOW()),
    updated_at  = TIMEZONE('utc', NOW())
  WHERE id = p_submission_id;

  -- sync_profile_kyc_status trigger flips profiles.kyc_status to 'rejected'
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_kyc_submission(UUID, TEXT) TO authenticated;

-- ============================================
-- PART 4: get_kyc_submissions_admin (queue listing)
-- ============================================
-- Returns base columns only. The API route joins decrypted profile info (username,
-- email) via the existing get_decrypted_profiles helper — same pattern as
-- app/api/admin/withdrawals/route.ts.

CREATE OR REPLACE FUNCTION public.get_kyc_submissions_admin(
  filter_status TEXT DEFAULT NULL
)
RETURNS TABLE (
  id              UUID,
  user_id         UUID,
  doc_type        TEXT,
  doc_front_path  TEXT,
  doc_back_path   TEXT,
  selfie_path     TEXT,
  phone           TEXT,
  status          TEXT,
  admin_notes     TEXT,
  reviewed_by     UUID,
  reviewed_at     TIMESTAMP WITH TIME ZONE,
  created_at      TIMESTAMP WITH TIME ZONE,
  updated_at      TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can view KYC submissions';
  END IF;

  RETURN QUERY
  SELECT
    ks.id, ks.user_id, ks.doc_type, ks.doc_front_path, ks.doc_back_path,
    ks.selfie_path, ks.phone, ks.status, ks.admin_notes, ks.reviewed_by,
    ks.reviewed_at, ks.created_at, ks.updated_at
  FROM public.kyc_submissions ks
  WHERE filter_status IS NULL
     OR filter_status = 'all'
     OR ks.status = filter_status
  ORDER BY ks.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_kyc_submissions_admin(TEXT) TO authenticated;
