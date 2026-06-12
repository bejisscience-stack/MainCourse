-- =============================================================================
-- Migration 248: Production reconciliation — standalone projects + bell routing
-- =============================================================================
-- Applied to: prod (nbecbsbuerdtakxkrduw) — staging is already current.
-- Bundles the May 23-24 2026 timestamp-prefixed migrations that prod has not
-- yet received. Re-running on a database that already has these objects is
-- idempotent for the CREATE TABLE / CREATE INDEX / ALTER PUBLICATION DO blocks
-- (IF NOT EXISTS / pg_publication_tables guard). CREATE POLICY blocks use
-- DROP POLICY IF EXISTS first, so they are also re-runnable.
--
-- Source files consolidated here (in execution order):
--   20260523000000_decouple_projects_from_courses.sql
--   20260523095001_announcement_channels_and_bell_routing.sql
--   20260523120000_drop_min_views_5000_floor.sql
--   20260523130000_create_project_resources.sql
--   20260523192700_harden_project_resources_url_scheme.sql
--   20260523192745_harden_announcement_insert_policy.sql (replaces policy from
--     20260523095001 — applies AFTER it)
--   247_project_owner_submission_reviews.sql
--   20260524162119_project_owner_criteria.sql
--
-- DELIBERATELY NOT INCLUDED (these are NOT deltas we want to push to prod):
--   - project_submissions.status column: added on staging via SQL editor, no
--     application code references it, intentionally skipped to keep prod clean.
--   - withdrawal_requests amount check change (staging=0.10, prod=50.00):
--     staging value is a testing artifact; prod 50.00 GEL minimum stays.
--   - project_subscriptions.price default (staging=0.10, prod=10.00):
--     staging value is a testing artifact; prod 10.00 GEL stays.
--   - chat-media bucket cap change: prod is correctly at 100 MB per the
--     lecturer-uploads feature; staging at 10 MB is BEHIND. Do not downgrade.
--   - Function-body refreshes for ~30 functions whose MD5 differs: vast
--     majority are RLS init-plan wrapping / search_path tightening that doesn't
--     change behavior. Out of scope for this surgical reconciliation.
--   - prod-only friend-system functions (cleanup_friend_request_on_unfriend,
--     etc.): kept untouched.
--   - prod-only service-images storage bucket: kept untouched.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. DECOUPLE PROJECTS FROM COURSES
-- =============================================================================

ALTER TABLE public.projects
  ALTER COLUMN course_id   DROP NOT NULL,
  ALTER COLUMN channel_id  DROP NOT NULL,
  ALTER COLUMN message_id  DROP NOT NULL;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

COMMENT ON COLUMN public.projects.thumbnail_url IS
  'Per-project thumbnail. For standalone projects (course_id IS NULL) this is the visual identity. For course-bound projects this is optional; UI falls back to courses.thumbnail_url when unset.';

DROP POLICY IF EXISTS "Users can view projects in enrolled courses" ON public.projects;
DROP POLICY IF EXISTS "Lecturers can create projects" ON public.projects;

DROP POLICY IF EXISTS "projects_select_v2" ON public.projects;
CREATE POLICY "projects_select_v2"
  ON public.projects FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR status IN ('active', 'pending_payment')
  );

DROP POLICY IF EXISTS "projects_insert_v2" ON public.projects;
CREATE POLICY "projects_insert_v2"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
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

ALTER TABLE public.project_submissions
  ALTER COLUMN course_id   DROP NOT NULL,
  ALTER COLUMN channel_id  DROP NOT NULL,
  ALTER COLUMN message_id  DROP NOT NULL;

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

-- Storage policies for the standalone-projects/{user_id}/ path namespace.
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

DROP POLICY IF EXISTS "Chat media standalone project read" ON storage.objects;
CREATE POLICY "Chat media standalone project read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-media'
  AND (storage.foldername(name))[1] = 'standalone-projects'
);

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

-- =============================================================================
-- 2. ANNOUNCEMENT CHANNELS + BELL NOTIFICATION ROUTING
-- =============================================================================

ALTER TABLE public.channels
  DROP CONSTRAINT IF EXISTS channels_type_check;
ALTER TABLE public.channels
  ADD CONSTRAINT channels_type_check
  CHECK (type IN ('text', 'voice', 'lectures', 'announcement'));

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'enrollment_approved',
    'enrollment_rejected',
    'bundle_enrollment_approved',
    'bundle_enrollment_rejected',
    'withdrawal_approved',
    'withdrawal_rejected',
    'admin_message',
    'system',
    'subscription_approved',
    'subscription_rejected',
    'announcement_message',
    'direct_message',
    'mention'
  ));

CREATE OR REPLACE FUNCTION public.notify_on_message_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_channel        RECORD;
  v_course_title   TEXT;
  v_poster_name    TEXT;
  v_preview        TEXT;
  v_announcement_recipients UUID[];
  v_mention_usernames TEXT[];
  v_mention_recipients UUID[];
  v_route_metadata JSONB;
BEGIN
  SELECT id, name, type, course_id
    INTO v_channel
    FROM public.channels
   WHERE id = NEW.channel_id;

  IF v_channel.id IS NULL THEN
    RETURN NEW;
  END IF;

  v_preview := COALESCE(NULLIF(LEFT(NEW.content, 140), ''), '');

  SELECT COALESCE(NULLIF(username, ''), 'A lecturer')
    INTO v_poster_name
    FROM public.profiles
   WHERE id = NEW.user_id;

  SELECT COALESCE(NULLIF(title, ''), '')
    INTO v_course_title
    FROM public.courses
   WHERE id = v_channel.course_id;

  v_route_metadata := jsonb_build_object(
    'course_id',    v_channel.course_id,
    'channel_id',   v_channel.id,
    'channel_name', v_channel.name,
    'message_id',   NEW.id
  );

  IF v_channel.type = 'announcement' THEN
    SELECT COALESCE(array_agg(DISTINCT e.user_id), ARRAY[]::UUID[])
      INTO v_announcement_recipients
      FROM public.enrollments e
     WHERE e.course_id = v_channel.course_id
       AND e.user_id <> NEW.user_id;

    IF array_length(v_announcement_recipients, 1) IS NOT NULL THEN
      INSERT INTO public.notifications (
        user_id, type, title, message, metadata, created_by
      )
      SELECT
        recipient_id,
        'announcement_message',
        jsonb_build_object(
          'en', v_poster_name || ' posted in #' || v_channel.name,
          'ge', v_poster_name || '-მა გამოაქვეყნა არხში #' || v_channel.name
        ),
        jsonb_build_object('en', v_preview, 'ge', v_preview),
        v_route_metadata,
        NEW.user_id
      FROM unnest(v_announcement_recipients) AS recipient_id;
    END IF;
  END IF;

  IF NEW.content IS NOT NULL AND NEW.content ~ '@[A-Za-z0-9_]+' THEN
    SELECT COALESCE(
             array_agg(DISTINCT lower(substring(m[1] FROM 2))),
             ARRAY[]::TEXT[]
           )
      INTO v_mention_usernames
      FROM regexp_matches(NEW.content, '(@[A-Za-z0-9_]+)', 'g') AS m;

    IF array_length(v_mention_usernames, 1) IS NOT NULL THEN
      SELECT COALESCE(array_agg(DISTINCT p.id), ARRAY[]::UUID[])
        INTO v_mention_recipients
        FROM public.profiles p
        JOIN public.enrollments e
          ON e.user_id = p.id AND e.course_id = v_channel.course_id
       WHERE lower(p.username) = ANY (v_mention_usernames)
         AND p.id <> NEW.user_id
         AND (
           v_channel.type <> 'announcement'
           OR NOT (p.id = ANY (v_announcement_recipients))
         );

      IF array_length(v_mention_recipients, 1) IS NOT NULL THEN
        INSERT INTO public.notifications (
          user_id, type, title, message, metadata, created_by
        )
        SELECT
          recipient_id,
          'mention',
          jsonb_build_object(
            'en', v_poster_name || ' mentioned you in #' || v_channel.name,
            'ge', v_poster_name || '-მა მოგიხსენიათ არხში #' || v_channel.name
          ),
          jsonb_build_object('en', v_preview, 'ge', v_preview),
          v_route_metadata,
          NEW.user_id
        FROM unnest(v_mention_recipients) AS recipient_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_insert_notify ON public.messages;
CREATE TRIGGER on_message_insert_notify
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_message_insert();

CREATE OR REPLACE FUNCTION public.notify_on_direct_message_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_poster_name TEXT;
  v_preview     TEXT;
  v_recipients  UUID[];
  v_metadata    JSONB;
BEGIN
  SELECT COALESCE(NULLIF(username, ''), 'Someone')
    INTO v_poster_name
    FROM public.profiles
   WHERE id = NEW.user_id;

  v_preview := COALESCE(NULLIF(LEFT(NEW.content, 140), ''), '');

  SELECT COALESCE(array_agg(DISTINCT p.user_id), ARRAY[]::UUID[])
    INTO v_recipients
    FROM public.dm_participants p
   WHERE p.conversation_id = NEW.conversation_id
     AND p.user_id <> NEW.user_id;

  IF array_length(v_recipients, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  v_metadata := jsonb_build_object(
    'conversation_id', NEW.conversation_id,
    'message_id',      NEW.id
  );

  INSERT INTO public.notifications (
    user_id, type, title, message, metadata, created_by
  )
  SELECT
    recipient_id,
    'direct_message',
    jsonb_build_object(
      'en', 'New message from ' || v_poster_name,
      'ge', 'ახალი შეტყობინება ' || v_poster_name || '-სგან'
    ),
    jsonb_build_object('en', v_preview, 'ge', v_preview),
    v_metadata,
    NEW.user_id
  FROM unnest(v_recipients) AS recipient_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_dm_message_insert_notify ON public.dm_messages;
CREATE TRIGGER on_dm_message_insert_notify
  AFTER INSERT ON public.dm_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_direct_message_insert();

REVOKE ALL ON FUNCTION public.notify_on_message_insert()        FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_on_direct_message_insert() FROM PUBLIC;

COMMENT ON FUNCTION public.notify_on_message_insert() IS
  'After-insert trigger on public.messages — fans out announcement and @mention bell notifications. SECURITY DEFINER.';
COMMENT ON FUNCTION public.notify_on_direct_message_insert() IS
  'After-insert trigger on public.dm_messages — creates a direct_message bell notification for the other DM participant(s). SECURITY DEFINER.';

-- RESTRICTIVE INSERT policy on messages — HARDENED version (joins through
-- channels rather than trusting messages.course_id from the client).
DROP POLICY IF EXISTS "Restrict announcement posting to lecturer or admin"
  ON public.messages;
CREATE POLICY "Restrict announcement posting to lecturer or admin"
  ON public.messages
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = messages.channel_id
        AND c.type = 'announcement'
    )
    OR EXISTS (
      SELECT 1
      FROM public.channels c
      JOIN public.courses co ON co.id = c.course_id
      WHERE c.id = messages.channel_id
        AND co.lecturer_id = auth.uid()
    )
    OR public.check_is_admin(auth.uid())
  );

-- =============================================================================
-- 3. DROP MIN_VIEWS 5000 FLOOR
-- =============================================================================

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_min_views_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_min_views_check CHECK (min_views >= 0);

-- =============================================================================
-- 4. PROJECT_RESOURCES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.project_resources (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('image', 'video', 'link')),
  title TEXT,
  url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

ALTER TABLE public.project_resources ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS project_resources_project_id_idx
  ON public.project_resources(project_id);
CREATE INDEX IF NOT EXISTS project_resources_display_order_idx
  ON public.project_resources(project_id, display_order);

DROP POLICY IF EXISTS "Anyone can view resources for active projects" ON public.project_resources;
CREATE POLICY "Anyone can view resources for active projects"
  ON public.project_resources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_resources.project_id
        AND p.start_date IS NOT NULL
        AND p.end_date IS NOT NULL
        AND CURRENT_DATE >= p.start_date
        AND CURRENT_DATE <= p.end_date
    )
  );

DROP POLICY IF EXISTS "Users can view resources in enrolled courses" ON public.project_resources;
CREATE POLICY "Users can view resources in enrolled courses"
  ON public.project_resources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_resources.project_id
        AND (
          EXISTS (
            SELECT 1 FROM public.enrollments e
            WHERE e.course_id = p.course_id
              AND e.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.courses c
            WHERE c.id = p.course_id
              AND c.lecturer_id = auth.uid()
          )
          OR p.user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Project access users can view resources" ON public.project_resources;
CREATE POLICY "Project access users can view resources"
  ON public.project_resources FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND has_project_access(auth.uid())
  );

DROP POLICY IF EXISTS "Project owners can insert resources" ON public.project_resources;
CREATE POLICY "Project owners can insert resources"
  ON public.project_resources FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_resources.project_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Project owners can update resources" ON public.project_resources;
CREATE POLICY "Project owners can update resources"
  ON public.project_resources FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_resources.project_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Project owners can delete resources" ON public.project_resources;
CREATE POLICY "Project owners can delete resources"
  ON public.project_resources FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_resources.project_id
        AND p.user_id = auth.uid()
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'project_resources'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.project_resources;
  END IF;
END $$;

-- URL-scheme guard (defense in depth alongside server-side validation).
ALTER TABLE public.project_resources
  DROP CONSTRAINT IF EXISTS project_resources_url_scheme_check;
ALTER TABLE public.project_resources
  ADD CONSTRAINT project_resources_url_scheme_check
  CHECK (
    (resource_type = 'link' AND url ~* '^https?://')
    OR (resource_type IN ('image', 'video') AND url !~ '://')
  );

COMMENT ON CONSTRAINT project_resources_url_scheme_check
  ON public.project_resources IS
  'Link URLs must be http(s); image/video URLs must be relative storage paths.';

-- =============================================================================
-- 5. PROJECT OWNER POLICIES — submission_reviews + project_criteria
-- =============================================================================

DROP POLICY IF EXISTS "project_owner_view_reviews" ON public.submission_reviews;
CREATE POLICY "project_owner_view_reviews"
  ON public.submission_reviews FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = submission_reviews.project_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "project_owner_create_reviews" ON public.submission_reviews;
CREATE POLICY "project_owner_create_reviews"
  ON public.submission_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = lecturer_id
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = submission_reviews.project_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "project_owner_update_reviews" ON public.submission_reviews;
CREATE POLICY "project_owner_update_reviews"
  ON public.submission_reviews FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = lecturer_id
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = submission_reviews.project_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = lecturer_id
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = submission_reviews.project_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "project_owner_create_criteria" ON public.project_criteria;
CREATE POLICY "project_owner_create_criteria"
  ON public.project_criteria FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_criteria.project_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "project_owner_update_criteria" ON public.project_criteria;
CREATE POLICY "project_owner_update_criteria"
  ON public.project_criteria FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_criteria.project_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_criteria.project_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "project_owner_delete_criteria" ON public.project_criteria;
CREATE POLICY "project_owner_delete_criteria"
  ON public.project_criteria FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_criteria.project_id
        AND p.user_id = auth.uid()
    )
  );

COMMIT;
