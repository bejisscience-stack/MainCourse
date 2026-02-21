-- Migration: Completely remove admin RLS policy from profiles to fix infinite recursion
-- Description: Instead of using RLS for admin access, we'll handle it in API routes using a function

-- Step 1: Drop ALL admin-related policies and functions
-- ============================================
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.get_user_role();

-- Step 2: Ensure users can view their own profile (this should work without recursion)
-- ============================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Step 3: Create a function for API routes to check admin status (bypasses RLS)
-- ============================================
-- This function runs with SECURITY DEFINER to completely bypass RLS
CREATE OR REPLACE FUNCTION public.check_is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- SECURITY DEFINER means this runs as the function owner (postgres), bypassing RLS
  -- This allows us to check admin status without triggering RLS policies
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = user_id;
  
  RETURN COALESCE(user_role, '') = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

-- Step 4: Create admin policy using the RPC function (should not cause recursion)
-- ============================================
-- The function uses SECURITY DEFINER, so it bypasses RLS when checking admin status
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.check_is_admin(auth.uid()));

-- Note: The check_is_admin function uses SECURITY DEFINER, which means it runs
-- as the function owner (postgres) and completely bypasses RLS. This prevents
-- the infinite recursion because the function's internal query doesn't trigger
-- the RLS policy check.

