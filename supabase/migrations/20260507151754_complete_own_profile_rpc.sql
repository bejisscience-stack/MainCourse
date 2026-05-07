-- A-19: Replace service-role profile UPDATE in /api/complete-profile with a
-- SECURITY DEFINER RPC whose UPDATE column list is the privilege whitelist.
--
-- The route can switch to a user-scoped Supabase client and call this RPC; a
-- future contributor cannot smuggle a privileged column (role, kyc_status,
-- balance, etc.) through an updated payload — the columns written are pinned
-- here in the function body.
--
-- Note: the protect_profiles_privileged_columns trigger blocks `profile_completed`
-- writes from the `authenticated` role (mig 218), so a plain user-scoped UPDATE
-- can't replace the service-role path. SECURITY DEFINER bypasses the trigger
-- (current_user becomes postgres, the early-return short-circuits) — that's
-- the deliberate trade: we trust THIS function because it whitelists columns,
-- not the entire route.

CREATE OR REPLACE FUNCTION public.complete_own_profile(
  p_username TEXT,
  p_role     TEXT,
  p_marketing_emails_consent BOOLEAN
)
RETURNS TABLE(username TEXT, role TEXT, profile_completed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_now TIMESTAMPTZ := now();
  v_username TEXT;
  v_already_completed BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_role NOT IN ('student', 'lecturer') THEN
    RAISE EXCEPTION 'Invalid role' USING ERRCODE = '22023';
  END IF;

  v_username := trim(coalesce(p_username, ''));
  -- Mirrors lib/schemas/index.ts completeProfileSchema: 3-30 chars, [a-zA-Z0-9_].
  IF v_username !~ '^[a-zA-Z0-9_]{3,30}$' THEN
    RAISE EXCEPTION 'Invalid username format' USING ERRCODE = '22023';
  END IF;

  SELECT p.profile_completed
    INTO v_already_completed
  FROM public.profiles p
  WHERE p.id = v_uid
  FOR UPDATE;

  IF v_already_completed IS NULL THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_already_completed = TRUE THEN
    RAISE EXCEPTION 'Profile already complete' USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles AS p SET
    username = v_username,
    profile_completed = TRUE,
    terms_accepted = TRUE,
    terms_accepted_at = v_now,
    marketing_emails_consent = coalesce(p_marketing_emails_consent, FALSE),
    marketing_emails_consent_at =
      CASE WHEN coalesce(p_marketing_emails_consent, FALSE) THEN v_now ELSE NULL END,
    lecturer_status = CASE WHEN p_role = 'lecturer' THEN 'pending'::text ELSE p.lecturer_status END,
    is_approved     = CASE WHEN p_role = 'lecturer' THEN FALSE          ELSE p.is_approved END
  WHERE p.id = v_uid
  RETURNING p.username, p.role, p.profile_completed
  INTO username, role, profile_completed;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_own_profile(TEXT, TEXT, BOOLEAN)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_own_profile(TEXT, TEXT, BOOLEAN)
  FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_own_profile(TEXT, TEXT, BOOLEAN)
  TO authenticated;
