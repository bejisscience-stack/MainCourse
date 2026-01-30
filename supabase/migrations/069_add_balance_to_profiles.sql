-- Migration: Add balance system to profiles
-- Description: Adds balance and bank_account_number columns to profiles table

-- Step 1: Add balance column to profiles table
-- ============================================
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS balance DECIMAL(10, 2) DEFAULT 0.00 NOT NULL;

-- Add constraint to prevent negative balance
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_balance_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_balance_check CHECK (balance >= 0);

-- Step 2: Add bank_account_number column to profiles table
-- ============================================
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS bank_account_number TEXT;

-- Step 3: Create indexes for balance queries
-- ============================================
CREATE INDEX IF NOT EXISTS profiles_balance_idx 
ON public.profiles(balance) 
WHERE balance > 0;

CREATE INDEX IF NOT EXISTS profiles_bank_account_idx 
ON public.profiles(bank_account_number) 
WHERE bank_account_number IS NOT NULL;

-- Step 4: Update existing users to have 0 balance
-- ============================================
UPDATE public.profiles 
SET balance = 0 
WHERE balance IS NULL;

