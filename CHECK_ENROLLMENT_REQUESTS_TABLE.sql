-- Check if enrollment_requests table exists and verify RLS policies
-- Run this in Supabase SQL Editor to verify the setup

-- 1. Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'enrollment_requests'
) AS table_exists;

-- 2. Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'enrollment_requests';

-- 3. Check if you have admin role
SELECT id, email, username, role 
FROM public.profiles 
WHERE email = 'bejisscience@gmail.com';

-- 4. Try to see enrollment requests (this should work if you're admin)
SELECT COUNT(*) as total_requests
FROM public.enrollment_requests;












