-- Security fix: drop self-deletion policy on enrollments
-- Enrollments represent paid course access. Self-deletion would bypass payment integrity
-- and could be exploited to re-trigger referral commissions.
-- Admin deletion is handled by reject_enrollment_request() SECURITY DEFINER RPC.

DROP POLICY IF EXISTS "Users can delete own enrollments" ON public.enrollments;
