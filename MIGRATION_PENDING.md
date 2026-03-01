# Pending Migration: Fix Lecturer Upload RLS

**Status**: Code committed, migration pending application to Supabase

**Commit**: `5c9e761` - "Fix lecturer upload RLS and remove file size limits"

**Branch**: `staging`

## What's Been Done

✅ Migration file created: `supabase/migrations/100_fix_lecturer_upload_policies.sql`
✅ Code changes:
  - `app/lecturer/dashboard/page.tsx` - Removed client-side file size checks
  - `components/CourseCreationModal.tsx` - Removed client-side file size checks
  - UI labels updated to remove size limit references
✅ All changes committed to `staging` branch

## What Needs to Be Done

The Supabase RLS and file size limit changes still need to be applied to the staging database:

### Manual Application Steps

1. Go to Supabase Dashboard: https://app.supabase.com/project/bvptqdmhuumjbyfnjxdt/sql

2. Click **"New Query"**

3. Run this SQL:

```sql
-- Drop existing INSERT policies that require course ownership
DROP POLICY IF EXISTS "Lecturers can upload videos" ON storage.objects;
DROP POLICY IF EXISTS "Lecturers can upload thumbnails" ON storage.objects;

-- Remove file size limits from both buckets (set to NULL for unlimited)
UPDATE storage.buckets SET file_size_limit = NULL
WHERE id IN ('course-videos', 'course-thumbnails');

-- New INSERT policy for course-videos with OR condition:
-- Allow uploads to course folders OR to user's own temporary folder during creation
CREATE POLICY "Lecturers can upload videos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'course-videos' AND
  auth.role() = 'authenticated' AND
  (
    -- Option A: Existing flow - upload to course folder the lecturer owns
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id::text = (storage.foldername(name))[1]
      AND courses.lecturer_id = auth.uid()
    )
    OR
    -- Option B: New flow - upload to user's temp folder during course creation
    (
      (storage.foldername(name))[1] = auth.uid()::text AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'lecturer'
      )
    )
  )
);

-- New INSERT policy for course-thumbnails with OR condition (same pattern)
CREATE POLICY "Lecturers can upload thumbnails"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'course-thumbnails' AND
  auth.role() = 'authenticated' AND
  (
    -- Option A: Existing flow - upload to course folder the lecturer owns
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id::text = (storage.foldername(name))[1]
      AND courses.lecturer_id = auth.uid()
    )
    OR
    -- Option B: New flow - upload to user's temp folder during course creation
    (
      (storage.foldername(name))[1] = auth.uid()::text AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'lecturer'
      )
    )
  )
);
```

4. Click **"Run"** to execute

## Testing

After applying the migration to Supabase:

1. Log in as a lecturer
2. Navigate to: Create Course → Step 3 (Media)
3. Upload a thumbnail → should succeed
4. Upload a video → should succeed
5. Verify existing course lecture uploads still work

Once tested and verified, delete this file and the fix will be complete.
