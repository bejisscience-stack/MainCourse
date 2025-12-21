# Fix Username Display in Chat Messages

## Issue
Chat messages are showing "User-{id}" instead of actual usernames like "Bejinio".

## Root Causes

1. **Profile fetch failing** - RLS policy might not be allowing profile access
2. **full_name is null/empty** - Profile exists but `full_name` field is not set
3. **RLS policy not applied** - Migration 018 might not have been run

## Solutions

### Step 1: Verify RLS Policy is Applied

Run this migration in Supabase SQL Editor if you haven't already:

```sql
-- Migration: Update profiles RLS to allow viewing profiles of users in same course
CREATE POLICY "Users can view profiles in same courses"
  ON public.profiles FOR SELECT
  USING (
    -- Users can view profiles of other users enrolled in the same courses
    EXISTS (
      SELECT 1 FROM public.enrollments e1
      JOIN public.enrollments e2 ON e1.course_id = e2.course_id
      WHERE e1.user_id = auth.uid()
      AND e2.user_id = profiles.id
      AND e1.user_id != e2.user_id
    )
    OR
    -- Lecturers can view profiles of users enrolled in their courses
    EXISTS (
      SELECT 1 FROM public.courses c
      JOIN public.enrollments e ON e.course_id = c.id
      WHERE c.lecturer_id = auth.uid()
      AND e.user_id = profiles.id
      AND c.lecturer_id != e.user_id
    )
    OR
    -- Users can view profiles of lecturers whose courses they're enrolled in
    EXISTS (
      SELECT 1 FROM public.courses c
      JOIN public.enrollments e ON e.course_id = c.id
      WHERE c.lecturer_id = profiles.id
      AND e.user_id = auth.uid()
      AND c.lecturer_id != e.user_id
    )
  );
```

### Step 2: Check if Profiles Have full_name Set

Run this query in Supabase SQL Editor to check:

```sql
SELECT id, email, full_name, 
       CASE WHEN full_name IS NULL OR full_name = '' THEN 'MISSING' ELSE 'OK' END as status
FROM public.profiles
ORDER BY created_at DESC
LIMIT 20;
```

If you see profiles with `full_name` as NULL or empty, update them:

```sql
-- Update profiles with missing full_name (use email username as fallback)
UPDATE public.profiles
SET full_name = SPLIT_PART(email, '@', 1)
WHERE full_name IS NULL OR full_name = '';
```

Or manually update specific users:

```sql
-- Update a specific user's full_name
UPDATE public.profiles
SET full_name = 'Bejinio'
WHERE id = '11ad6f55-bc71-4110-817c-248e44b00ed9';
```

### Step 3: Verify User is Enrolled in Course

Make sure the user sending messages is enrolled in the course:

```sql
-- Check enrollments for a specific user
SELECT e.*, c.title as course_title
FROM public.enrollments e
JOIN public.courses c ON e.course_id = c.id
WHERE e.user_id = '11ad6f55-bc71-4110-817c-248e44b00ed9';
```

### Step 4: Test Profile Fetch

Test if profiles can be fetched with this query (run as the logged-in user):

```sql
-- This should return profiles of users in the same courses
SELECT p.id, p.email, p.full_name
FROM public.profiles p
WHERE EXISTS (
  SELECT 1 FROM public.enrollments e1
  JOIN public.enrollments e2 ON e1.course_id = e2.course_id
  WHERE e1.user_id = auth.uid()
  AND e2.user_id = p.id
  AND e1.user_id != e2.user_id
)
LIMIT 10;
```

## Code Changes Made

I've updated the code to:
1. ✅ Better handle empty `full_name` values
2. ✅ Improved fallback logic
3. ✅ Added better logging for debugging
4. ✅ Trim whitespace from usernames

## Debugging

Check browser console and server logs for:
- `Successfully fetched X profiles out of Y users` - Good sign
- `Failed to fetch profile for user` - RLS issue
- `Profile exists but full_name is empty` - Need to update profile

## Quick Fix

If you want to quickly fix a specific user's display name:

1. Go to Supabase Dashboard → Table Editor → `profiles`
2. Find the user by their ID or email
3. Update the `full_name` field to "Bejinio" (or their actual name)
4. Save

The next message they send should show the correct name!









