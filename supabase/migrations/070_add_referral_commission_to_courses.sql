-- Migration: Add referral commission percentage to courses
-- Description: Allows lecturers to set referral commission percentage for each course

-- Step 1: Add referral_commission_percentage column to courses table
-- ============================================
ALTER TABLE public.courses 
ADD COLUMN IF NOT EXISTS referral_commission_percentage INTEGER DEFAULT 0 NOT NULL;

-- Add constraint to ensure percentage is between 0 and 100
ALTER TABLE public.courses
DROP CONSTRAINT IF EXISTS courses_referral_commission_check;

ALTER TABLE public.courses
ADD CONSTRAINT courses_referral_commission_check 
CHECK (referral_commission_percentage >= 0 AND referral_commission_percentage <= 100);

-- Step 2: Create index for commission queries
-- ============================================
CREATE INDEX IF NOT EXISTS courses_referral_commission_idx 
ON public.courses(referral_commission_percentage) 
WHERE referral_commission_percentage > 0;

-- Step 3: Update existing courses to have 0% commission
-- ============================================
UPDATE public.courses 
SET referral_commission_percentage = 0 
WHERE referral_commission_percentage IS NULL;

