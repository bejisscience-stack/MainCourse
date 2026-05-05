-- Migration 214: KYC submissions table + profiles.kyc_status column
--
-- Adds identity-verification gating to first-time withdrawals.
-- - profiles.kyc_status mirrors the latest kyc_submissions.status (kept in sync via trigger)
-- - kyc_submissions stores per-attempt history (supports resubmission after rejection)
-- - withdrawal_requests gains a nullable FK to the verified submission for audit
-- - Backfill grandfathers any user who has already completed a withdrawal
--
-- Migration 217 extends create_withdrawal_request to require kyc_status='verified'.

-- ============================================
-- PART 1: profiles.kyc_status column
-- ============================================
-- DEFAULT 'not_submitted' so handle_new_user() (migration 171) keeps working untouched.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kyc_status TEXT
    NOT NULL
    DEFAULT 'not_submitted'
    CHECK (kyc_status IN ('not_submitted', 'pending', 'verified', 'rejected'));

-- Backfill: grandfather users who have already completed a withdrawal
-- so the new gate only affects truly first-time withdrawals.
UPDATE public.profiles p
SET kyc_status = 'verified'
WHERE kyc_status = 'not_submitted'
  AND EXISTS (
    SELECT 1 FROM public.withdrawal_requests wr
    WHERE wr.user_id = p.id AND wr.status = 'completed'
  );

-- ============================================
-- PART 2: kyc_submissions table
-- ============================================

CREATE TABLE IF NOT EXISTS public.kyc_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type        TEXT NOT NULL CHECK (doc_type IN ('id_card', 'passport', 'drivers_license')),
  doc_front_path  TEXT NOT NULL,
  doc_back_path   TEXT,
  selfie_path     TEXT NOT NULL,
  phone           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'verified', 'rejected')),
  admin_notes     TEXT,
  reviewed_by     UUID REFERENCES auth.users(id),
  reviewed_at     TIMESTAMP WITH TIME ZONE,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  -- Passport is single-sided; ID card and driver's license require both sides.
  CONSTRAINT kyc_submissions_back_required
    CHECK (doc_type = 'passport' OR doc_back_path IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS kyc_submissions_user_id_idx
  ON public.kyc_submissions(user_id);

CREATE INDEX IF NOT EXISTS kyc_submissions_status_created_idx
  ON public.kyc_submissions(status, created_at DESC);

-- One pending submission per user (matches withdrawal_requests pattern in migration 072)
CREATE UNIQUE INDEX IF NOT EXISTS kyc_submissions_one_pending_per_user_idx
  ON public.kyc_submissions(user_id) WHERE status = 'pending';

-- updated_at trigger (reuses public.handle_updated_at from earlier migrations)
DROP TRIGGER IF EXISTS on_kyc_submission_updated ON public.kyc_submissions;
CREATE TRIGGER on_kyc_submission_updated
  BEFORE UPDATE ON public.kyc_submissions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- PART 3: Sync trigger keeps profiles.kyc_status in lockstep
-- ============================================

CREATE OR REPLACE FUNCTION public.sync_profile_kyc_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET kyc_status = NEW.status,
      updated_at = TIMEZONE('utc', NOW())
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS kyc_submissions_sync_profile ON public.kyc_submissions;
CREATE TRIGGER kyc_submissions_sync_profile
  AFTER INSERT OR UPDATE OF status ON public.kyc_submissions
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_kyc_status();

-- ============================================
-- PART 4: RLS on kyc_submissions
-- ============================================

ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own kyc submissions" ON public.kyc_submissions;
CREATE POLICY "Users can view own kyc submissions"
  ON public.kyc_submissions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own kyc submissions" ON public.kyc_submissions;
CREATE POLICY "Users can insert own kyc submissions"
  ON public.kyc_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all kyc submissions" ON public.kyc_submissions;
CREATE POLICY "Admins can view all kyc submissions"
  ON public.kyc_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update kyc submissions" ON public.kyc_submissions;
CREATE POLICY "Admins can update kyc submissions"
  ON public.kyc_submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- PART 5: withdrawal_requests audit linkage
-- ============================================

ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS kyc_submission_id UUID
    REFERENCES public.kyc_submissions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS withdrawal_requests_kyc_submission_id_idx
  ON public.withdrawal_requests(kyc_submission_id);

-- ============================================
-- PART 6: Protect profiles.kyc_status from direct user UPDATEs
-- ============================================
-- The "Users can update own profile" RLS policy (migration 002) allows users
-- to UPDATE their own profile row, which would let them self-set kyc_status
-- to 'verified' and bypass the withdrawal gate. Restricting that policy or
-- moving to per-column GRANTs requires touching every legitimate profile
-- update path (avatar, username, balance, etc.). Instead, this BEFORE UPDATE
-- trigger raises whenever a non-trigger caller tries to change kyc_status.
--
-- The trigger fires only on UPDATEs that mention kyc_status in the SET clause
-- (BEFORE UPDATE OF kyc_status), so direct user UPDATEs of avatar/username/
-- etc. pay no overhead.
--
-- pg_trigger_depth() returns 1 at the outermost trigger. The
-- sync_profile_kyc_status trigger is fired from kyc_submissions writes (depth
-- 1), and its inner UPDATE on profiles fires this protect trigger at depth 2,
-- which the guard allows.
--
-- ADMIN OVERRIDE: To manually unblock a user, prefer inserting a verified
-- kyc_submissions row (which fires the sync trigger). If you must update
-- profiles.kyc_status directly via the Dashboard SQL editor, wrap the UPDATE
-- in `SET LOCAL session_replication_role = 'replica';` to suppress triggers.

CREATE OR REPLACE FUNCTION public.protect_profiles_kyc_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.kyc_status IS DISTINCT FROM OLD.kyc_status
     AND pg_trigger_depth() = 1 THEN
    RAISE EXCEPTION
      'profiles.kyc_status cannot be modified directly; submit a KYC review instead'
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profiles_kyc_status ON public.profiles;
CREATE TRIGGER protect_profiles_kyc_status
  BEFORE UPDATE OF kyc_status ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profiles_kyc_status();

-- ============================================
-- PART 7: Protect profiles.role from direct user UPDATEs
-- ============================================
-- Required for the KYC gate to be effective: without this, a user could run
-- `UPDATE profiles SET role = 'admin' WHERE id = auth.uid()` (allowed by the
-- migration-002 "Users can update own profile" RLS), then self-approve their
-- own pending KYC submission via /api/admin/kyc/{id}/approve, which lets the
-- sync trigger flip kyc_status to 'verified' (the protect_profiles_kyc_status
-- trigger correctly allows that nested update at depth 2).
--
-- This trigger uses a different mechanism from kyc_status: pg_trigger_depth()
-- would also block legitimate admin RPCs (approve_lecturer_account etc.) that
-- update role at depth 1 from SECURITY DEFINER. Instead we check
-- `current_user`: PostgREST executes user queries as the 'authenticated' (or
-- 'anon') role, while SECURITY DEFINER functions run as their owner
-- (postgres) and Dashboard / service-role API run as superuser/service_role.
--
-- Side note: balance, lecturer_status, is_approved, project_access_expires_at
-- and other privilege-bearing columns on profiles are also user-mutable via
-- the same RLS gap. Those should get analogous protection in a separate
-- audit pass; only `role` is fixed here because it directly invalidates the
-- KYC admin-review gate.

CREATE OR REPLACE FUNCTION public.protect_profiles_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION
      'profiles.role cannot be modified by users'
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profiles_role ON public.profiles;
CREATE TRIGGER protect_profiles_role
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profiles_role();
