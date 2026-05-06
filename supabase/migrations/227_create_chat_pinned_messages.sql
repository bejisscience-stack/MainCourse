-- Migration: Persist pinned course chat messages
-- Description: Allows course lecturers/admins to pin multiple messages per channel.

CREATE TABLE IF NOT EXISTS public.chat_pinned_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  pinned_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pinned_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE (message_id)
);

ALTER TABLE public.chat_pinned_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_pinned_messages REPLICA IDENTITY FULL;

CREATE INDEX IF NOT EXISTS chat_pinned_messages_channel_pinned_at_idx
  ON public.chat_pinned_messages(channel_id, pinned_at DESC);

CREATE INDEX IF NOT EXISTS chat_pinned_messages_course_id_idx
  ON public.chat_pinned_messages(course_id);

CREATE INDEX IF NOT EXISTS chat_pinned_messages_pinned_by_idx
  ON public.chat_pinned_messages(pinned_by);

DROP POLICY IF EXISTS "Users can view accessible chat pins"
  ON public.chat_pinned_messages;
CREATE POLICY "Users can view accessible chat pins"
  ON public.chat_pinned_messages FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      public.check_is_admin(auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.enrollments e
        WHERE e.course_id = chat_pinned_messages.course_id
          AND e.user_id = auth.uid()
          AND (e.expires_at IS NULL OR e.expires_at > NOW())
      )
      OR EXISTS (
        SELECT 1
        FROM public.courses c
        WHERE c.id = chat_pinned_messages.course_id
          AND c.lecturer_id = auth.uid()
      )
      OR (
        public.has_project_access(auth.uid())
        AND EXISTS (
          SELECT 1
          FROM public.channels ch
          WHERE ch.id = chat_pinned_messages.channel_id
            AND LOWER(ch.name) = 'projects'
        )
      )
    )
  );

DROP POLICY IF EXISTS "Lecturers and admins can pin chat messages"
  ON public.chat_pinned_messages;
CREATE POLICY "Lecturers and admins can pin chat messages"
  ON public.chat_pinned_messages FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND pinned_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.messages m
      WHERE m.id = chat_pinned_messages.message_id
        AND m.channel_id = chat_pinned_messages.channel_id
        AND m.course_id = chat_pinned_messages.course_id
    )
    AND (
      public.check_is_admin(auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.courses c
        WHERE c.id = chat_pinned_messages.course_id
          AND c.lecturer_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Lecturers and admins can unpin chat messages"
  ON public.chat_pinned_messages;
CREATE POLICY "Lecturers and admins can unpin chat messages"
  ON public.chat_pinned_messages FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND (
      public.check_is_admin(auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.courses c
        WHERE c.id = chat_pinned_messages.course_id
          AND c.lecturer_id = auth.uid()
      )
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_pinned_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_pinned_messages;
  END IF;
END $$;

COMMENT ON TABLE public.chat_pinned_messages IS
  'Pinned course chat messages visible to users with access to the channel.';
