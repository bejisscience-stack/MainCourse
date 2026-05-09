-- Migration: Persist direct-message reactions
-- Description: Mirrors public.message_reactions (mig 226) for DM conversations.
--              RLS authorizes via dm_participants on the underlying dm_messages row.
--              Edge function (dm-messages PATCH) writes through service role; client
--              policies are kept tight as a defense-in-depth fallback.

CREATE TABLE IF NOT EXISTS public.dm_message_reactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  message_id UUID REFERENCES public.dm_messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  emoji TEXT NOT NULL CHECK (emoji IN ('👍', '❤️', '😂', '😮', '😢', '🙏')),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE (message_id, user_id, emoji)
);

ALTER TABLE public.dm_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS dm_message_reactions_message_id_idx
  ON public.dm_message_reactions(message_id);
CREATE INDEX IF NOT EXISTS dm_message_reactions_user_id_idx
  ON public.dm_message_reactions(user_id);

DROP POLICY IF EXISTS "Participants can view dm message reactions"
  ON public.dm_message_reactions;
CREATE POLICY "Participants can view dm message reactions"
  ON public.dm_message_reactions FOR SELECT
  USING (
    (select auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.dm_messages m
      JOIN public.dm_participants p
        ON p.conversation_id = m.conversation_id
      WHERE m.id = dm_message_reactions.message_id
        AND p.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Participants can insert own dm message reactions"
  ON public.dm_message_reactions;
CREATE POLICY "Participants can insert own dm message reactions"
  ON public.dm_message_reactions FOR INSERT
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.dm_messages m
      JOIN public.dm_participants p
        ON p.conversation_id = m.conversation_id
      WHERE m.id = dm_message_reactions.message_id
        AND p.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete own dm message reactions"
  ON public.dm_message_reactions;
CREATE POLICY "Users can delete own dm message reactions"
  ON public.dm_message_reactions FOR DELETE
  USING ((select auth.uid()) = user_id);

COMMENT ON TABLE public.dm_message_reactions IS
  'Whitelisted emoji reactions for direct-message conversations.';
