-- Migration: Fix infinite recursion in admin profiles RLS policy
-- Description: The previous admin policy caused infinite recursion. This fixes it by using a function that bypasses RLS.

-- Step 1: Drop the problematic policy first
-- ============================================
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Step 2: Create a function to check if current user is admin (completely bypasses RLS)
-- ============================================
-- This function uses SECURITY DEFINER and explicitly sets search_path to avoid RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Get the role directly from profiles table, bypassing RLS with SECURITY DEFINER
  -- We use a direct query that won't trigger RLS because the function runs as the definer
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = auth.uid();
  
  RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

-- Step 3: Create a new policy that uses the function (avoids recursion)
-- ============================================
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

-- Step 4: Ensure users can still view their own profile (this should already exist, but ensure it)
-- ============================================
-- The "Users can view own profile" policy should already exist from migration 002
-- But let's make sure it's there and not conflicting
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

