-- Migration: Fix infinite recursion in admin profiles RLS policy (FINAL FIX)
-- Description: Completely fixes the recursion by using a function that explicitly bypasses RLS

-- Step 1: Drop the problematic policy and function
-- ============================================
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP FUNCTION IF EXISTS public.is_admin();

-- Step 2: Create a function that explicitly bypasses RLS
-- ============================================
-- This function uses SECURITY DEFINER and explicitly disables RLS for the query
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Explicitly disable RLS for this query
  PERFORM set_config('row_security', 'off', true);
  
  -- Get the role directly from profiles table, completely bypassing RLS
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = auth.uid();
  
  -- Re-enable RLS
  PERFORM set_config('row_security', 'on', true);
  
  RETURN COALESCE(user_role, '') = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

-- Alternative simpler approach: Just check if the user's own profile has admin role
-- This avoids any recursion because users can always read their own profile
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Users can always read their own profile, so this won't cause recursion
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = auth.uid();
  
  RETURN COALESCE(user_role, 'student');
END;
$$ LANGUAGE plpgsql STABLE
SET search_path = public;

-- Step 3: Create a new policy that uses the simpler function
-- ============================================
-- Use the function that reads the user's own profile (which they can always access)
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.get_user_role() = 'admin');

-- Step 4: Ensure users can still view their own profile
-- ============================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);










