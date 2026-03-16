-- Migration: Add payout tracking to submission_reviews + expand balance_transactions source
-- Description: Adds paid_at, paid_by, payout_amount to submission_reviews.
-- Expands balance_transactions.source CHECK to include 'submission_payout'.

-- Step 1: Add payout tracking columns to submission_reviews
ALTER TABLE public.submission_reviews
ADD COLUMN IF NOT EXISTS payout_amount DECIMAL(10, 2) DEFAULT 0 CHECK (payout_amount >= 0);

ALTER TABLE public.submission_reviews
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.submission_reviews
ADD COLUMN IF NOT EXISTS paid_by UUID REFERENCES auth.users(id);

COMMENT ON COLUMN public.submission_reviews.payout_amount IS 'Calculated payout: (view_count / 1000) * payment_amount (RPM). Set by admin before payment.';
COMMENT ON COLUMN public.submission_reviews.paid_at IS 'Timestamp when admin executed payout to student balance.';
COMMENT ON COLUMN public.submission_reviews.paid_by IS 'Admin user ID who executed the payout.';

-- Step 2: Create index for unpaid reviews (admin dashboard query)
CREATE INDEX IF NOT EXISTS submission_reviews_unpaid_idx
ON public.submission_reviews(status, paid_at)
WHERE status = 'accepted' AND paid_at IS NULL;

-- Step 3: Expand balance_transactions source CHECK constraint
ALTER TABLE public.balance_transactions
DROP CONSTRAINT IF EXISTS balance_transactions_source_check;

ALTER TABLE public.balance_transactions
ADD CONSTRAINT balance_transactions_source_check
CHECK (source IN ('referral_commission', 'course_purchase', 'withdrawal', 'admin_adjustment', 'submission_payout'));

-- Step 4: Expand balance_transactions reference_type CHECK constraint
ALTER TABLE public.balance_transactions
DROP CONSTRAINT IF EXISTS balance_transactions_reference_type_check;

ALTER TABLE public.balance_transactions
ADD CONSTRAINT balance_transactions_reference_type_check
CHECK (reference_type IN ('enrollment_request', 'withdrawal_request', 'admin_action', 'submission_review'));

-- Step 5: Allow admins to update submission_reviews (for payout tracking)
DROP POLICY IF EXISTS "Admins can update submission reviews for payout" ON public.submission_reviews;
CREATE POLICY "Admins can update submission reviews for payout"
  ON public.submission_reviews FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
