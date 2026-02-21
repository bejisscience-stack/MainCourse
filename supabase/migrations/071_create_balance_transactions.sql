-- Migration: Create balance transactions table
-- Description: Tracks all balance changes for audit trail

-- Step 1: Create balance_transactions table
-- ============================================
CREATE TABLE IF NOT EXISTS public.balance_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('student', 'lecturer', 'admin')),
  amount DECIMAL(10, 2) NOT NULL CHECK (amount != 0),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('credit', 'debit')),
  source TEXT NOT NULL CHECK (source IN ('referral_commission', 'course_purchase', 'withdrawal', 'admin_adjustment')),
  reference_id UUID, -- References enrollment_request.id or withdrawal_request.id
  reference_type TEXT CHECK (reference_type IN ('enrollment_request', 'withdrawal_request', 'admin_action')),
  description TEXT,
  balance_before DECIMAL(10, 2),
  balance_after DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Step 2: Enable Row Level Security
-- ============================================
ALTER TABLE public.balance_transactions ENABLE ROW LEVEL SECURITY;

-- Step 3: Create indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS balance_transactions_user_id_idx 
ON public.balance_transactions(user_id);

CREATE INDEX IF NOT EXISTS balance_transactions_reference_idx 
ON public.balance_transactions(reference_id, reference_type);

CREATE INDEX IF NOT EXISTS balance_transactions_created_at_idx 
ON public.balance_transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS balance_transactions_source_idx 
ON public.balance_transactions(source);

CREATE INDEX IF NOT EXISTS balance_transactions_user_created_idx 
ON public.balance_transactions(user_id, created_at DESC);

-- Step 4: RLS Policies
-- ============================================
-- Users can view their own balance transactions
DROP POLICY IF EXISTS "Users can view own balance transactions" ON public.balance_transactions;
CREATE POLICY "Users can view own balance transactions"
  ON public.balance_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all balance transactions
DROP POLICY IF EXISTS "Admins can view all balance transactions" ON public.balance_transactions;
CREATE POLICY "Admins can view all balance transactions"
  ON public.balance_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

