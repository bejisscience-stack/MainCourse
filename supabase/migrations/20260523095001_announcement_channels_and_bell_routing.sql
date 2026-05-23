-- Migration: Announcement channels + bell notifications + deep-link routing
-- Description:
--   1. Adds 'announcement' to channels.type CHECK constraint.
--   2. Adds 'announcement_message', 'direct_message', 'mention' to notifications.type CHECK.
--   3. RESTRICTIVE INSERT policy on messages: in announcement channels, only the
--      course lecturer or an admin may post (read remains unchanged).
--   4. AFTER-INSERT trigger on messages that fans out bell notifications for
--      announcement-channel posts (to every enrolled student except the poster)
--      and for @username mentions (to mentioned users who are enrolled).
--   5. AFTER-INSERT trigger on dm_messages that creates a bell notification for
--      the other participant(s) in the DM conversation.
--   Notification rows carry metadata enough for the bell dropdown to deep-link
--   to the source chat (course_id, channel_id, channel_name, message_id for
--   channel messages; conversation_id, message_id for DMs).

-- ============================================================================
-- 1. Extend channels.type CHECK to include 'announcement'
-- ============================================================================
ALTER TABLE public.channels
  DROP CONSTRAINT IF EXISTS channels_type_check;

ALTER TABLE public.channels
  ADD CONSTRAINT channels_type_check
  CHECK (type IN ('text', 'voice', 'lectures', 'announcement'));

-- ============================================================================
-- 2. Extend notifications.type CHECK to include the three new bell types.
--    Preserve all previously-allowed values (cf. migration 077 + 107).
-- ============================================================================
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

-- ============================================================================
-- 3. RESTRICTIVE INSERT policy on messages.
--    AND'd against the existing permissive INSERT policies (enrolled-user,
--    lecturer, admin, project-access). Lets through any insert UNLESS the
--    target channel is announcement-typed AND the caller is neither the
--    course lecturer nor an admin.
-- ============================================================================
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
      SELECT 1 FROM public.courses co
      WHERE co.id = messages.course_id
        AND co.lecturer_id = auth.uid()
    )
    OR public.check_is_admin(auth.uid())
  );

-- ============================================================================
-- 4. Trigger: notify_on_message_insert
--    Fans out announcement_message notifications (to enrollees minus poster)
--    and mention notifications (to @username matches who are enrolled).
--    A user who is mentioned in an announcement post receives only the
--    announcement_message row (mention is suppressed to avoid duplication).
-- ============================================================================
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
  -- Look up the channel (need type + name for routing) and short-circuit
  -- when the channel no longer exists (shouldn't happen — FK guards it).
  SELECT id, name, type, course_id
    INTO v_channel
    FROM public.channels
   WHERE id = NEW.channel_id;

  IF v_channel.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Build a short preview from message content (NULL-safe for attachment-only).
  v_preview := COALESCE(NULLIF(LEFT(NEW.content, 140), ''), '');

  -- Look up poster username + course title for the notification title strings.
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

  ------------------------------------------------------------------
  -- Announcement fanout: every enrollee except the poster.
  ------------------------------------------------------------------
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

  ------------------------------------------------------------------
  -- Mention fanout: anyone matching @username in the content who is enrolled
  -- in the course, not the poster, and (if announcement) not already covered.
  ------------------------------------------------------------------
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

-- ============================================================================
-- 5. Trigger: notify_on_direct_message_insert
--    Bell notification to the other DM participant(s).
-- ============================================================================
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

-- ============================================================================
-- 6. Permissions
--    The trigger functions run as SECURITY DEFINER, so they bypass RLS for
--    the notifications INSERT. No additional grants are required for the
--    triggers themselves; they fire under whichever role inserted the message.
-- ============================================================================
REVOKE ALL ON FUNCTION public.notify_on_message_insert()        FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_on_direct_message_insert() FROM PUBLIC;

COMMENT ON FUNCTION public.notify_on_message_insert() IS
  'After-insert trigger on public.messages — fans out announcement and @mention bell notifications. SECURITY DEFINER. See migration 20260523134022.';
COMMENT ON FUNCTION public.notify_on_direct_message_insert() IS
  'After-insert trigger on public.dm_messages — creates a direct_message bell notification for the other DM participant(s). SECURITY DEFINER. See migration 20260523134022.';
