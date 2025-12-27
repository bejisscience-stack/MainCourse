-- Migration: Create withdrawal requests table
-- Description: Allows users to request withdrawal of their balance

-- Step 1: Create withdrawal_requests table
-- ============================================
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('student', 'lecturer')),
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 20.00), -- Minimum 20 GEL
  bank_account_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  admin_notes TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Step 2: Enable Row Level Security
-- ============================================
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Step 3: Create indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS withdrawal_requests_user_id_idx 
ON public.withdrawal_requests(user_id);

CREATE INDEX IF NOT EXISTS withdrawal_requests_status_idx 
ON public.withdrawal_requests(status);

CREATE INDEX IF NOT EXISTS withdrawal_requests_created_at_idx 
ON public.withdrawal_requests(created_at DESC);

-- Unique index to prevent multiple pending requests per user
CREATE UNIQUE INDEX IF NOT EXISTS withdrawal_requests_user_pending_idx 
ON public.withdrawal_requests(user_id) 
WHERE status = 'pending';

-- Step 4: RLS Policies
-- ============================================
-- Users can view their own withdrawal requests
DROP POLICY IF EXISTS "Users can view own withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Users can view own withdrawal requests"
  ON public.withdrawal_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own withdrawal requests
DROP POLICY IF EXISTS "Users can insert own withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Users can insert own withdrawal requests"
  ON public.withdrawal_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all withdrawal requests
DROP POLICY IF EXISTS "Admins can view all withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Admins can view all withdrawal requests"
  ON public.withdrawal_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update withdrawal requests
DROP POLICY IF EXISTS "Admins can update withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Admins can update withdrawal requests"
  ON public.withdrawal_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Step 5: Trigger for updated_at
-- ============================================
DROP TRIGGER IF EXISTS on_withdrawal_request_updated ON public.withdrawal_requests;
CREATE TRIGGER on_withdrawal_request_updated
  BEFORE UPDATE ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

