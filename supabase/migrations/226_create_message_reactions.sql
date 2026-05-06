-- Migration: Persist course chat message reactions
-- Description: Stores whitelisted emoji reactions per user/message so reactions survive reloads.

CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  emoji TEXT NOT NULL CHECK (emoji IN ('👍', '❤️', '😂', '😮', '😢', '🙏')),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE (message_id, user_id, emoji)
);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS message_reactions_message_id_idx
  ON public.message_reactions(message_id);
CREATE INDEX IF NOT EXISTS message_reactions_user_id_idx
  ON public.message_reactions(user_id);

DROP POLICY IF EXISTS "Users can view accessible message reactions"
  ON public.message_reactions;
CREATE POLICY "Users can view accessible message reactions"
  ON public.message_reactions FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.messages m
      WHERE m.id = message_reactions.message_id
        AND (
          public.check_is_admin(auth.uid())
          OR EXISTS (
            SELECT 1
            FROM public.enrollments e
            WHERE e.course_id = m.course_id
              AND e.user_id = auth.uid()
              AND (e.expires_at IS NULL OR e.expires_at > NOW())
          )
          OR EXISTS (
            SELECT 1
            FROM public.courses c
            WHERE c.id = m.course_id
              AND c.lecturer_id = auth.uid()
          )
          OR (
            public.has_project_access(auth.uid())
            AND EXISTS (
              SELECT 1
              FROM public.channels ch
              WHERE ch.id = m.channel_id
                AND LOWER(ch.name) = 'projects'
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS "Users can insert own accessible message reactions"
  ON public.message_reactions;
CREATE POLICY "Users can insert own accessible message reactions"
  ON public.message_reactions FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.messages m
      WHERE m.id = message_reactions.message_id
        AND (
          public.check_is_admin(auth.uid())
          OR EXISTS (
            SELECT 1
            FROM public.enrollments e
            WHERE e.course_id = m.course_id
              AND e.user_id = auth.uid()
              AND (e.expires_at IS NULL OR e.expires_at > NOW())
          )
          OR EXISTS (
            SELECT 1
            FROM public.courses c
            WHERE c.id = m.course_id
              AND c.lecturer_id = auth.uid()
          )
          OR (
            public.has_project_access(auth.uid())
            AND EXISTS (
              SELECT 1
              FROM public.channels ch
              WHERE ch.id = m.channel_id
                AND LOWER(ch.name) = 'projects'
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS "Users can delete own message reactions"
  ON public.message_reactions;
CREATE POLICY "Users can delete own message reactions"
  ON public.message_reactions FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.message_reactions IS
  'Whitelisted emoji reactions for course chat messages.';
