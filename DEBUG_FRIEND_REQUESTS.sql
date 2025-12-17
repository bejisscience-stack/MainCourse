-- Debug Script: Check Friend Requests RLS and Data
-- Run this in Supabase SQL Editor to diagnose friend request visibility issues

-- 1. Check if the friend request exists
SELECT 
  id,
  sender_id,
  receiver_id,
  status,
  created_at,
  updated_at
FROM public.friend_requests
WHERE id = '3b9f4387-812d-4472-9af8-509a40c52dc5';

-- 2. Check all pending friend requests
SELECT 
  id,
  sender_id,
  receiver_id,
  status,
  created_at
FROM public.friend_requests
WHERE status = 'pending'
ORDER BY created_at DESC;

-- 3. Verify RLS policies exist
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
WHERE tablename = 'friend_requests'
ORDER BY policyname;

-- 4. Check if receiver_id matches beji's user ID
-- Replace '79165a6e-e163-4fe4-80c2-fb2a01abb63d' with beji's actual user ID if different
SELECT 
  fr.id,
  fr.sender_id,
  fr.receiver_id,
  fr.status,
  sender_profile.username as sender_username,
  receiver_profile.username as receiver_username
FROM public.friend_requests fr
LEFT JOIN public.profiles sender_profile ON fr.sender_id = sender_profile.id
LEFT JOIN public.profiles receiver_profile ON fr.receiver_id = receiver_profile.id
WHERE fr.receiver_id = '79165a6e-e163-4fe4-80c2-fb2a01abb63d'
  AND fr.status = 'pending';

-- 5. Test RLS policy manually (this simulates what happens when beji queries)
-- This should return the friend request if RLS is working
-- Note: This won't work in SQL Editor (no auth context), but shows the expected query
/*
SELECT * FROM public.friend_requests
WHERE (sender_id = '79165a6e-e163-4fe4-80c2-fb2a01abb63d' 
   OR receiver_id = '79165a6e-e163-4fe4-80c2-fb2a01abb63d')
AND status = 'pending';
*/

-- 6. Verify the receiver profile exists
SELECT 
  id,
  username,
  email,
  role
FROM public.profiles
WHERE id = '79165a6e-e163-4fe4-80c2-fb2a01abb63d';

-- 7. Check sender profile
SELECT 
  id,
  username,
  email,
  role
FROM public.profiles
WHERE id = '65c5cb36-8518-4b9d-8e83-7e87917201d7';

