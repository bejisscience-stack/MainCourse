-- Migration 155: Fix courses RLS policy name mismatch
--
-- Problem: If any environment skipped mig 008 or ran migrations out of order,
-- the mig-005 permissive policies ("Authenticated users can insert/update courses")
-- could still be live. RLS uses OR semantics — a single permissive policy wins,
-- so any authenticated user (including students) could INSERT/UPDATE courses.
--
-- This migration defensively drops ALL known historical policy names and recreates
-- exactly 4 clean policies.

BEGIN;

-- ============================================================
-- 1. Drop ALL known policy names (historical + current)
-- ============================================================

-- From mig 005 (the dangerous ones — allow any authenticated user)
DROP POLICY IF EXISTS "Authenticated users can insert courses"   ON public.courses;
DROP POLICY IF EXISTS "Authenticated users can update courses"   ON public.courses;
DROP POLICY IF EXISTS "Authenticated users can delete courses"   ON public.courses;

-- From mig 008/009 (lecturer-only, replaced by mig 123)
DROP POLICY IF EXISTS "Lecturers can insert their own courses"   ON public.courses;
DROP POLICY IF EXISTS "Lecturers can update their own courses"   ON public.courses;
DROP POLICY IF EXISTS "Lecturers can delete their own courses"   ON public.courses;

-- From mig 123 (replaced by mig 150 for INSERT, current for UPDATE)
DROP POLICY IF EXISTS "Lecturers and admins can insert courses"  ON public.courses;
DROP POLICY IF EXISTS "Lecturers and admins can update courses"  ON public.courses;

-- From mig 150 (current INSERT)
DROP POLICY IF EXISTS "Approved lecturers and admins can insert courses" ON public.courses;

-- SELECT (current — will be recreated identically)
DROP POLICY IF EXISTS "Courses are viewable by everyone"         ON public.courses;

-- ============================================================
-- 2. Recreate 4 clean policies
-- ============================================================

-- SELECT: anyone can view courses
CREATE POLICY "Courses are viewable by everyone"
  ON public.courses FOR SELECT
  USING (true);

-- INSERT: approved lecturers + admins, lecturer_id must match caller
CREATE POLICY "Approved lecturers and admins can insert courses"
  ON public.courses FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (
        (p.role = 'lecturer' AND p.is_approved = true)
        OR p.role = 'admin'
      )
    )
    AND lecturer_id = auth.uid()
  );

-- UPDATE: own lecturer + admins can update any course
CREATE POLICY "Lecturers and admins can update courses"
  ON public.courses FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND (
      (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'lecturer'
      ) AND lecturer_id = auth.uid())
      OR
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    )
  );

-- DELETE: admin only
CREATE POLICY "Admins can delete courses"
  ON public.courses FOR DELETE
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

COMMIT;

-- ============================================================
-- Verification: run after deploying to check live policies
-- ============================================================
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies WHERE tablename = 'courses'
-- ORDER BY cmd;
--
-- Expected: exactly 4 rows:
--   "Admins can delete courses"                        | DELETE
--   "Approved lecturers and admins can insert courses" | INSERT
--   "Courses are viewable by everyone"                 | SELECT
--   "Lecturers and admins can update courses"          | UPDATE
