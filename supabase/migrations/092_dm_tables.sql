-- Migration 092: Create DM conversations and messages tables
-- Description: Adds direct messaging between friends
-- Depends on: migration 091 (friend_requests & friendships)

-- ============================================================
-- 1. TABLES
-- ============================================================

-- DM conversations (one per unique user pair)
CREATE TABLE IF NOT EXISTS public.dm_conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user1_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user2_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  last_message_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  -- Canonical ordering: smaller UUID first
  CHECK (user1_id < user2_id),
  UNIQUE(user1_id, user2_id)
);

-- DM messages
CREATE TABLE IF NOT EXISTS public.dm_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID REFERENCES public.dm_conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 4000),
  reply_to_id UUID REFERENCES public.dm_messages(id) ON DELETE SET NULL,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- ============================================================
-- 2. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.dm_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;

-- dm_conversations policies -----------------------------------------------

-- Participants can view their conversations
DROP POLICY IF EXISTS "Participants can view dm conversations" ON public.dm_conversations;
CREATE POLICY "Participants can view dm conversations"
  ON public.dm_conversations FOR SELECT
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Participants can create conversations (must be a participant AND must be friends)
DROP POLICY IF EXISTS "Participants can create dm conversations" ON public.dm_conversations;
CREATE POLICY "Participants can create dm conversations"
  ON public.dm_conversations FOR INSERT
  WITH CHECK (
    (auth.uid() = user1_id OR auth.uid() = user2_id)
    AND EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.user1_id = dm_conversations.user1_id
      AND f.user2_id = dm_conversations.user2_id
    )
  );

-- NOTE: No UPDATE policy for dm_conversations.
-- last_message_at is updated by the SECURITY DEFINER trigger on_dm_message_sent.
-- Removing user-facing UPDATE prevents tampering with user1_id/user2_id.

-- dm_messages policies ---------------------------------------------------

-- Participants can view messages in their conversations
DROP POLICY IF EXISTS "Participants can view dm messages" ON public.dm_messages;
CREATE POLICY "Participants can view dm messages"
  ON public.dm_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.dm_conversations c
      WHERE c.id = dm_messages.conversation_id
      AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
  );

-- Participants can send messages to their conversations
DROP POLICY IF EXISTS "Participants can send dm messages" ON public.dm_messages;
CREATE POLICY "Participants can send dm messages"
  ON public.dm_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.dm_conversations c
      WHERE c.id = conversation_id
      AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
  );

-- Authors can update their own messages (for editing, cannot change authorship)
DROP POLICY IF EXISTS "Authors can update dm messages" ON public.dm_messages;
CREATE POLICY "Authors can update dm messages"
  ON public.dm_messages FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Authors can delete their own messages
DROP POLICY IF EXISTS "Authors can delete dm messages" ON public.dm_messages;
CREATE POLICY "Authors can delete dm messages"
  ON public.dm_messages FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 3. INDEXES
-- ============================================================

-- Conversation lookups by participant
CREATE INDEX IF NOT EXISTS idx_dm_conversations_user1 ON public.dm_conversations(user1_id);
CREATE INDEX IF NOT EXISTS idx_dm_conversations_user2 ON public.dm_conversations(user2_id);
CREATE INDEX IF NOT EXISTS idx_dm_conversations_last_msg ON public.dm_conversations(last_message_at DESC);

-- Message pagination: most recent messages per conversation
CREATE INDEX IF NOT EXISTS idx_dm_messages_conversation_created
  ON public.dm_messages(conversation_id, created_at DESC);

-- Message author lookup
CREATE INDEX IF NOT EXISTS idx_dm_messages_user ON public.dm_messages(user_id);

-- Reply-to lookups
CREATE INDEX IF NOT EXISTS idx_dm_messages_reply_to ON public.dm_messages(reply_to_id)
  WHERE reply_to_id IS NOT NULL;

-- ============================================================
-- 4. TRIGGERS & FUNCTIONS
-- ============================================================

-- Update last_message_at on dm_conversations when a new message is inserted
CREATE OR REPLACE FUNCTION public.update_dm_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.dm_conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_dm_message_sent ON public.dm_messages;
CREATE TRIGGER on_dm_message_sent
  AFTER INSERT ON public.dm_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_dm_conversation_last_message();

-- Prevent column tampering on dm_messages UPDATE (only content and edited_at can change)
CREATE OR REPLACE FUNCTION public.restrict_dm_message_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.conversation_id != OLD.conversation_id
     OR NEW.user_id != OLD.user_id
     OR NEW.reply_to_id IS DISTINCT FROM OLD.reply_to_id
     OR NEW.created_at != OLD.created_at THEN
    RAISE EXCEPTION 'Only content and edited_at can be modified';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS restrict_dm_message_update ON public.dm_messages;
CREATE TRIGGER restrict_dm_message_update
  BEFORE UPDATE ON public.dm_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.restrict_dm_message_update();

-- ============================================================
-- 5. ENABLE REALTIME
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'dm_conversations'
    AND schemaname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_conversations;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'dm_messages'
    AND schemaname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_messages;
  END IF;
END $$;

-- ============================================================
-- 6. COMMENTS
-- ============================================================

COMMENT ON TABLE public.dm_conversations IS 'Direct message conversations between two users (user1_id < user2_id)';
COMMENT ON TABLE public.dm_messages IS 'Messages within DM conversations, supports replies and editing';
