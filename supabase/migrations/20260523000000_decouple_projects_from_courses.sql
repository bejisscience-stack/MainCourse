-- =============================================================================
-- Migration: Decouple projects from courses
-- =============================================================================
-- Purpose:
--   Allow lecturers to create projects without first creating a course.
--   Today, projects are hard-coupled to courses via NOT NULL FKs on
--   course_id / channel_id / message_id, and the INSERT RLS policy requires
--   the lecturer to own the referenced course (mig 050). After this migration:
--
--   - Standalone projects exist with course_id/channel_id/message_id = NULL.
--   - Approved lecturers (profiles.role='lecturer' AND lecturer_status='approved')
--     can insert standalone projects.
--   - Legacy course-bound projects keep working exactly as before.
--   - Display layer reads projects.thumbnail_url first, falling back to
--     courses.thumbnail_url when course_id is set.
--   - Any authenticated user can view active/pending_payment projects (per
--     product decision). Submit/apply access remains gated by the existing
--     project_subscriptions table (mig 099) — unchanged here.
--   - project_submissions FKs to course_id / channel_id / message_id are
--     relaxed to NULL so standalone projects can later accept submissions
--     (submission UI is a follow-up; only the schema readiness is here).
--   - chat-media storage gains an INSERT policy + SELECT/UPDATE/DELETE policies
--     for a new path namespace `standalone-projects/{user_id}/{file}` so
--     standalone project videos and thumbnails can be uploaded/read.
--
-- Down-migration (manual): see DOWN block at the bottom.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Relax NOT NULL constraints on projects
-- -----------------------------------------------------------------------------

ALTER TABLE public.projects
  ALTER COLUMN course_id   DROP NOT NULL,
  ALTER COLUMN channel_id  DROP NOT NULL,
  ALTER COLUMN message_id  DROP NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. Add projects.thumbnail_url for standalone projects
-- -----------------------------------------------------------------------------

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

COMMENT ON COLUMN public.projects.thumbnail_url IS
  'Per-project thumbnail. For standalone projects (course_id IS NULL) this is the visual identity. For course-bound projects this is optional; UI falls back to courses.thumbnail_url when unset.';

-- -----------------------------------------------------------------------------
-- 3. Rewrite RLS policies on projects
-- -----------------------------------------------------------------------------

-- Drop the two old policies installed by mig 050.
DROP POLICY IF EXISTS "Users can view projects in enrolled courses" ON public.projects;
DROP POLICY IF EXISTS "Lecturers can create projects" ON public.projects;

-- SELECT: any authenticated user can read active/pending_payment projects;
-- the project owner (lecturer) can always read their own regardless of status.
-- The anon SELECT policy from mig 076 (public view of active projects) is
-- unaffected and continues to handle unauthenticated callers.
CREATE POLICY "projects_select_v2"
  ON public.projects FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR status IN ('active', 'pending_payment')
  );

-- INSERT: approved lecturers can create standalone projects (course_id IS NULL);
-- course owners can still create course-bound projects (legacy path).
CREATE POLICY "projects_insert_v2"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      -- Standalone path: lecturer role + approved status required.
      (
        course_id IS NULL
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'lecturer'
            AND p.lecturer_status = 'approved'
        )
      )
      OR
      -- Legacy course-bound path: lecturer must own the referenced course.
      (
        course_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.courses c
          WHERE c.id = course_id
            AND c.lecturer_id = auth.uid()
        )
      )
    )
  );

-- UPDATE / DELETE policies from mig 050 already key on user_id = auth.uid();
-- they remain valid for both paths and are intentionally not touched.

-- -----------------------------------------------------------------------------
-- 4. Relax project_submissions FKs (forward-compat for standalone projects)
-- -----------------------------------------------------------------------------

ALTER TABLE public.project_submissions
  ALTER COLUMN course_id   DROP NOT NULL,
  ALTER COLUMN channel_id  DROP NOT NULL,
  ALTER COLUMN message_id  DROP NOT NULL;

-- The existing project_submissions SELECT policy gates on course_id enrollment
-- (mig 051). For standalone projects, that branch is harmless (returns false
-- because course_id is NULL). The project owner ("lecturer") can still see all
-- submissions to their projects via the existing user_id = auth.uid() policies
-- if we add one — submissions UI for standalone is out-of-scope here. Add a
-- minimal "project owner can view submissions to their project" policy now so
-- the door is open without changing the legacy path.

DROP POLICY IF EXISTS "project_owner_view_submissions" ON public.project_submissions;
CREATE POLICY "project_owner_view_submissions"
  ON public.project_submissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_submissions.project_id
        AND p.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 5. Storage policies for standalone-projects/{user_id}/{file} path namespace
-- -----------------------------------------------------------------------------
-- chat-media bucket is private (mig 235). Existing policies key on
-- (storage.foldername(name))[1]::uuid = course_id. Standalone uploads use a
-- literal-prefix path: `standalone-projects/{user_id}/{filename}`.
--   foldername[1] = 'standalone-projects'
--   foldername[2] = user_id (text)

-- INSERT: approved lecturer can upload to their own standalone path.
DROP POLICY IF EXISTS "Chat media standalone project upload" ON storage.objects;
CREATE POLICY "Chat media standalone project upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND (storage.foldername(name))[1] = 'standalone-projects'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'lecturer'
      AND p.lecturer_status = 'approved'
  )
);

-- SELECT: any authenticated user can read standalone-projects/* (mirrors the
-- product decision that any authenticated user can view standalone projects).
-- Defense-in-depth only: edge functions sign URLs with the service role.
DROP POLICY IF EXISTS "Chat media standalone project read" ON storage.objects;
CREATE POLICY "Chat media standalone project read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-media'
  AND (storage.foldername(name))[1] = 'standalone-projects'
);

-- UPDATE / DELETE: owner only.
DROP POLICY IF EXISTS "Chat media standalone project owner update" ON storage.objects;
CREATE POLICY "Chat media standalone project owner update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'chat-media'
  AND (storage.foldername(name))[1] = 'standalone-projects'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

DROP POLICY IF EXISTS "Chat media standalone project owner delete" ON storage.objects;
CREATE POLICY "Chat media standalone project owner delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-media'
  AND (storage.foldername(name))[1] = 'standalone-projects'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

COMMIT;

-- =============================================================================
-- DOWN MIGRATION (run manually if rollback is needed)
-- =============================================================================
-- WARNING: relaxing NOT NULL cannot be straightforwardly reverted while NULL
-- rows exist. The down path requires backfilling NULL course_id/channel_id/
-- message_id values (e.g., by deleting standalone projects) before re-applying
-- the NOT NULL constraints.
--
-- BEGIN;
--   DROP POLICY IF EXISTS "Chat media standalone project owner delete" ON storage.objects;
--   DROP POLICY IF EXISTS "Chat media standalone project owner update" ON storage.objects;
--   DROP POLICY IF EXISTS "Chat media standalone project read"        ON storage.objects;
--   DROP POLICY IF EXISTS "Chat media standalone project upload"      ON storage.objects;
--
--   DROP POLICY IF EXISTS "project_owner_view_submissions" ON public.project_submissions;
--   -- (No SET NOT NULL on project_submissions until orphans are cleared.)
--
--   DROP POLICY IF EXISTS "projects_insert_v2" ON public.projects;
--   DROP POLICY IF EXISTS "projects_select_v2" ON public.projects;
--
--   -- Restore the original mig 050 policies verbatim:
--   CREATE POLICY "Users can view projects in enrolled courses"
--     ON public.projects FOR SELECT
--     USING (
--       EXISTS (SELECT 1 FROM public.enrollments e
--               WHERE e.course_id = projects.course_id AND e.user_id = auth.uid())
--       OR EXISTS (SELECT 1 FROM public.courses c
--                  WHERE c.id = projects.course_id AND c.lecturer_id = auth.uid())
--     );
--   CREATE POLICY "Lecturers can create projects"
--     ON public.projects FOR INSERT
--     WITH CHECK (
--       auth.uid() = user_id
--       AND EXISTS (SELECT 1 FROM public.courses c
--                   WHERE c.id = projects.course_id AND c.lecturer_id = auth.uid())
--     );
--
--   ALTER TABLE public.projects DROP COLUMN IF EXISTS thumbnail_url;
--   -- (SET NOT NULL on projects deferred — requires deleting all NULL-course rows first.)
-- COMMIT;
