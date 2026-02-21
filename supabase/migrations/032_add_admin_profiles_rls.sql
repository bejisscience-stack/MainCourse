-- Migration: Add admin RLS policy for profiles table
-- Description: Allows admins to view all profiles for admin functionality

-- Add policy: Admins can view all profiles
-- Note: We use a subquery to check if the current user is an admin
-- This avoids circular dependency issues
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

