-- FIX: Restrict referrals INSERT policy to only allow users to insert their own referrals
-- All referral inserts go through SECURITY DEFINER RPCs (create_referral_from_enrollment),
-- which bypass RLS, so this won't break existing flows.
DROP POLICY IF EXISTS "System can insert referrals" ON public.referrals;

CREATE POLICY "Users can insert own referrals"
  ON public.referrals FOR INSERT
  WITH CHECK (auth.uid() = referred_user_id);
