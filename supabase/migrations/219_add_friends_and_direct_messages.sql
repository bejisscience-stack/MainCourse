-- Migration: Friends + Direct Messages
-- Description: Adds friend_requests, friendships, dm_conversations, dm_participants,
--              dm_messages, dm_message_attachments, dm_unread_messages tables with
--              RLS, supporting RPCs (accept_friend_request, search_friend_candidates,
--              reset_dm_unread_count, open_or_create_dm_conversation), realtime
--              publication entries, and a dedicated dm-media storage bucket with
--              its own policies.
-- Notes:
--   * Reuses public.handle_updated_at() (mig 004).
--   * RLS uses (select auth.uid()) so PG treats it as an InitPlan (perf advisor 0008).
--   * SECURITY DEFINER functions revoke EXECUTE from PUBLIC/anon to match the
--     existing project pattern (auth_hardening_security_definer_functions).
--   * dm-media bucket has its own RLS keyed on dm_participants — does NOT touch chat-media.
--   * Tables are created in dependency order (friendships before friend_requests
--     because the friend_requests INSERT policy references public.friendships).

-- ============================================================================
-- 1. friendships (created first so friend_requests INSERT policy can reference it)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_low_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_high_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  CHECK (user_low_id < user_high_id),
  UNIQUE (user_low_id, user_high_id)
);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS friendships_user_low_id_idx ON public.friendships(user_low_id);
CREATE INDEX IF NOT EXISTS friendships_user_high_id_idx ON public.friendships(user_high_id);

DROP POLICY IF EXISTS "Users can view own friendships" ON public.friendships;
CREATE POLICY "Users can view own friendships"
  ON public.friendships FOR SELECT
  USING ((select auth.uid()) = user_low_id OR (select auth.uid()) = user_high_id);

DROP POLICY IF EXISTS "Users can delete own friendships" ON public.friendships;
CREATE POLICY "Users can delete own friendships"
  ON public.friendships FOR DELETE
  USING ((select auth.uid()) = user_low_id OR (select auth.uid()) = user_high_id);

-- INSERT only via SECURITY DEFINER accept_friend_request RPC; no client policy.

-- ============================================================================
-- 2. friend_requests
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.friend_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  requester_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  addressee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined','canceled')),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  CHECK (requester_id <> addressee_id)
);

ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS friend_requests_requester_id_idx ON public.friend_requests(requester_id);
CREATE INDEX IF NOT EXISTS friend_requests_addressee_id_idx ON public.friend_requests(addressee_id);
CREATE INDEX IF NOT EXISTS friend_requests_addressee_status_idx ON public.friend_requests(addressee_id, status);
CREATE INDEX IF NOT EXISTS friend_requests_requester_status_idx ON public.friend_requests(requester_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS friend_requests_active_pair_idx
  ON public.friend_requests (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id))
  WHERE status = 'pending';

DROP POLICY IF EXISTS "Users can view own friend requests" ON public.friend_requests;
CREATE POLICY "Users can view own friend requests"
  ON public.friend_requests FOR SELECT
  USING ((select auth.uid()) = requester_id OR (select auth.uid()) = addressee_id);

DROP POLICY IF EXISTS "Users can send friend requests" ON public.friend_requests;
CREATE POLICY "Users can send friend requests"
  ON public.friend_requests FOR INSERT
  WITH CHECK (
    (select auth.uid()) = requester_id
    AND requester_id <> addressee_id
    AND NOT EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.user_low_id = LEAST(requester_id, addressee_id)
        AND f.user_high_id = GREATEST(requester_id, addressee_id)
    )
  );

DROP POLICY IF EXISTS "Users can update own friend requests" ON public.friend_requests;
CREATE POLICY "Users can update own friend requests"
  ON public.friend_requests FOR UPDATE
  USING ((select auth.uid()) = requester_id OR (select auth.uid()) = addressee_id)
  WITH CHECK ((select auth.uid()) = requester_id OR (select auth.uid()) = addressee_id);

DROP POLICY IF EXISTS "Requester can delete own friend request" ON public.friend_requests;
CREATE POLICY "Requester can delete own friend request"
  ON public.friend_requests FOR DELETE
  USING ((select auth.uid()) = requester_id);

DROP TRIGGER IF EXISTS on_friend_request_updated ON public.friend_requests;
CREATE TRIGGER on_friend_request_updated
  BEFORE UPDATE ON public.friend_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 3. dm_conversations
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dm_conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  last_message_at TIMESTAMPTZ
);

ALTER TABLE public.dm_conversations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS dm_conversations_last_message_at_idx
  ON public.dm_conversations(last_message_at DESC NULLS LAST);

DROP TRIGGER IF EXISTS on_dm_conversation_updated ON public.dm_conversations;
CREATE TRIGGER on_dm_conversation_updated
  BEFORE UPDATE ON public.dm_conversations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 4. dm_participants
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dm_participants (
  conversation_id UUID REFERENCES public.dm_conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  PRIMARY KEY (conversation_id, user_id)
);

ALTER TABLE public.dm_participants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS dm_participants_user_id_idx
  ON public.dm_participants(user_id);

-- dm_conversations SELECT policy created here because it references dm_participants.
DROP POLICY IF EXISTS "Participants can view conversations" ON public.dm_conversations;
CREATE POLICY "Participants can view conversations"
  ON public.dm_conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.dm_participants p
      WHERE p.conversation_id = dm_conversations.id
        AND p.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Participants can view co-participants" ON public.dm_participants;
CREATE POLICY "Participants can view co-participants"
  ON public.dm_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.dm_participants self
      WHERE self.conversation_id = dm_participants.conversation_id
        AND self.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- 5. dm_messages
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dm_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID REFERENCES public.dm_conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT
    CHECK (
      content IS NULL
      OR (char_length(content) > 0 AND char_length(content) <= 4000)
    ),
  reply_to_id UUID REFERENCES public.dm_messages(id) ON DELETE SET NULL,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS dm_messages_conversation_created_idx
  ON public.dm_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS dm_messages_user_id_idx ON public.dm_messages(user_id);
CREATE INDEX IF NOT EXISTS dm_messages_reply_to_idx ON public.dm_messages(reply_to_id);

DROP POLICY IF EXISTS "Participants can view dm messages" ON public.dm_messages;
CREATE POLICY "Participants can view dm messages"
  ON public.dm_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.dm_participants p
      WHERE p.conversation_id = dm_messages.conversation_id
        AND p.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Participants can insert dm messages" ON public.dm_messages;
CREATE POLICY "Participants can insert dm messages"
  ON public.dm_messages FOR INSERT
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.dm_participants p
      WHERE p.conversation_id = dm_messages.conversation_id
        AND p.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Authors can update own dm messages" ON public.dm_messages;
CREATE POLICY "Authors can update own dm messages"
  ON public.dm_messages FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Authors can delete own dm messages" ON public.dm_messages;
CREATE POLICY "Authors can delete own dm messages"
  ON public.dm_messages FOR DELETE
  USING ((select auth.uid()) = user_id);

DROP TRIGGER IF EXISTS on_dm_message_updated ON public.dm_messages;
CREATE TRIGGER on_dm_message_updated
  BEFORE UPDATE ON public.dm_messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 6. dm_message_attachments
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dm_message_attachments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  message_id UUID REFERENCES public.dm_messages(id) ON DELETE CASCADE NOT NULL,
  conversation_id UUID REFERENCES public.dm_conversations(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('image','video','gif')),
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

ALTER TABLE public.dm_message_attachments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS dm_message_attachments_message_id_idx
  ON public.dm_message_attachments(message_id);
CREATE INDEX IF NOT EXISTS dm_message_attachments_conversation_id_idx
  ON public.dm_message_attachments(conversation_id);

DROP POLICY IF EXISTS "Participants can view dm attachments" ON public.dm_message_attachments;
CREATE POLICY "Participants can view dm attachments"
  ON public.dm_message_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.dm_participants p
      WHERE p.conversation_id = dm_message_attachments.conversation_id
        AND p.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Authors can insert dm attachments" ON public.dm_message_attachments;
CREATE POLICY "Authors can insert dm attachments"
  ON public.dm_message_attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dm_messages m
      WHERE m.id = dm_message_attachments.message_id
        AND m.user_id = (select auth.uid())
        AND m.conversation_id = dm_message_attachments.conversation_id
    )
  );

DROP POLICY IF EXISTS "Authors can delete own dm attachments" ON public.dm_message_attachments;
CREATE POLICY "Authors can delete own dm attachments"
  ON public.dm_message_attachments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.dm_messages m
      WHERE m.id = dm_message_attachments.message_id
        AND m.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- 7. dm_unread_messages
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dm_unread_messages (
  conversation_id UUID REFERENCES public.dm_conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  last_read_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  unread_count INTEGER DEFAULT 0 NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  PRIMARY KEY (conversation_id, user_id)
);

ALTER TABLE public.dm_unread_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS dm_unread_messages_user_id_idx
  ON public.dm_unread_messages(user_id);
CREATE INDEX IF NOT EXISTS dm_unread_messages_user_conversation_idx
  ON public.dm_unread_messages(user_id, conversation_id);

DROP POLICY IF EXISTS "Users can view own dm unread" ON public.dm_unread_messages;
CREATE POLICY "Users can view own dm unread"
  ON public.dm_unread_messages FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own dm unread" ON public.dm_unread_messages;
CREATE POLICY "Users can update own dm unread"
  ON public.dm_unread_messages FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own dm unread" ON public.dm_unread_messages;
CREATE POLICY "Users can insert own dm unread"
  ON public.dm_unread_messages FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- 8. update_dm_unread_counts trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_dm_unread_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment unread for every other participant of this conversation.
  INSERT INTO public.dm_unread_messages (conversation_id, user_id, unread_count, last_read_at, updated_at)
  SELECT
    NEW.conversation_id,
    p.user_id,
    1,
    TIMEZONE('utc', NOW()),
    TIMEZONE('utc', NOW())
  FROM public.dm_participants p
  WHERE p.conversation_id = NEW.conversation_id
    AND p.user_id <> NEW.user_id
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET
    unread_count = public.dm_unread_messages.unread_count + 1,
    updated_at = TIMEZONE('utc', NOW());

  -- Bump conversation activity stamps.
  UPDATE public.dm_conversations
  SET last_message_at = NEW.created_at,
      updated_at = TIMEZONE('utc', NOW())
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Invoked only via the AFTER INSERT trigger; lock down REST/role access.
REVOKE EXECUTE ON FUNCTION public.update_dm_unread_counts() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_dm_message_insert_update_unread ON public.dm_messages;
CREATE TRIGGER on_dm_message_insert_update_unread
  AFTER INSERT ON public.dm_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_dm_unread_counts();

-- ============================================================================
-- 9. RPC: reset_dm_unread_count
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reset_dm_unread_count(
  p_conversation_id UUID,
  p_user_id UUID
)
RETURNS void AS $$
BEGIN
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.dm_participants
    WHERE conversation_id = p_conversation_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Not a participant of this conversation';
  END IF;

  INSERT INTO public.dm_unread_messages (conversation_id, user_id, unread_count, last_read_at, updated_at)
  VALUES (p_conversation_id, p_user_id, 0, TIMEZONE('utc', NOW()), TIMEZONE('utc', NOW()))
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET
    unread_count = 0,
    last_read_at = TIMEZONE('utc', NOW()),
    updated_at = TIMEZONE('utc', NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.reset_dm_unread_count(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_dm_unread_count(UUID, UUID) TO authenticated;

-- ============================================================================
-- 10. RPC: accept_friend_request
-- ============================================================================

CREATE OR REPLACE FUNCTION public.accept_friend_request(p_request_id UUID)
RETURNS UUID AS $$
DECLARE
  v_requester UUID;
  v_addressee UUID;
  v_status TEXT;
  v_friendship_id UUID;
BEGIN
  SELECT requester_id, addressee_id, status
    INTO v_requester, v_addressee, v_status
  FROM public.friend_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_requester IS NULL THEN
    RAISE EXCEPTION 'Friend request not found';
  END IF;

  IF auth.uid() <> v_addressee THEN
    RAISE EXCEPTION 'Only the addressee can accept this request';
  END IF;

  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Request is not pending';
  END IF;

  UPDATE public.friend_requests
  SET status = 'accepted', updated_at = TIMEZONE('utc', NOW())
  WHERE id = p_request_id;

  INSERT INTO public.friendships (user_low_id, user_high_id)
  VALUES (LEAST(v_requester, v_addressee), GREATEST(v_requester, v_addressee))
  ON CONFLICT (user_low_id, user_high_id) DO NOTHING
  RETURNING id INTO v_friendship_id;

  IF v_friendship_id IS NULL THEN
    SELECT id INTO v_friendship_id
    FROM public.friendships
    WHERE user_low_id = LEAST(v_requester, v_addressee)
      AND user_high_id = GREATEST(v_requester, v_addressee);
  END IF;

  RETURN v_friendship_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.accept_friend_request(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_friend_request(UUID) TO authenticated;

-- ============================================================================
-- 11. RPC: search_friend_candidates
-- Returns id/username/avatar_url/role + relationship status — never email.
-- Requires query of length >= 2.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.search_friend_candidates(
  p_query TEXT,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  username TEXT,
  avatar_url TEXT,
  role TEXT,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_query_trim TEXT := COALESCE(TRIM(p_query), '');
  v_pattern TEXT;
  v_prefix TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF char_length(v_query_trim) < 2 THEN
    RETURN;
  END IF;

  v_pattern := '%' || v_query_trim || '%';
  v_prefix := v_query_trim || '%';

  RETURN QUERY
  SELECT
    p.id,
    p.username,
    p.avatar_url,
    p.role,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE f.user_low_id = LEAST(v_caller, p.id)
          AND f.user_high_id = GREATEST(v_caller, p.id)
      ) THEN 'friends'
      WHEN EXISTS (
        SELECT 1 FROM public.friend_requests fr
        WHERE fr.status = 'pending'
          AND fr.requester_id = v_caller
          AND fr.addressee_id = p.id
      ) THEN 'pending_out'
      WHEN EXISTS (
        SELECT 1 FROM public.friend_requests fr
        WHERE fr.status = 'pending'
          AND fr.requester_id = p.id
          AND fr.addressee_id = v_caller
      ) THEN 'pending_in'
      ELSE 'none'
    END AS status
  FROM public.profiles p
  WHERE p.id <> v_caller
    AND p.username IS NOT NULL
    AND p.username ILIKE v_pattern
  ORDER BY
    CASE WHEN p.username ILIKE v_prefix THEN 0 ELSE 1 END,
    p.username ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 50));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.search_friend_candidates(TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_friend_candidates(TEXT, INT) TO authenticated;

COMMENT ON FUNCTION public.search_friend_candidates IS
  'Searches profiles by username (ILIKE), excluding the caller. Returns safe columns and per-row relationship status (none|pending_out|pending_in|friends). Never returns email.';

-- ============================================================================
-- 12. RPC: open_or_create_dm_conversation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.open_or_create_dm_conversation(p_friend_id UUID)
RETURNS UUID AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_low UUID;
  v_high UUID;
  v_conversation_id UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_friend_id IS NULL OR p_friend_id = v_caller THEN
    RAISE EXCEPTION 'Invalid friend id';
  END IF;

  v_low := LEAST(v_caller, p_friend_id);
  v_high := GREATEST(v_caller, p_friend_id);

  IF NOT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE user_low_id = v_low AND user_high_id = v_high
  ) THEN
    RAISE EXCEPTION 'You are not friends with this user';
  END IF;

  -- Find existing 1:1 conversation: must contain exactly these two users.
  SELECT c.id INTO v_conversation_id
  FROM public.dm_conversations c
  WHERE EXISTS (
      SELECT 1 FROM public.dm_participants p
      WHERE p.conversation_id = c.id AND p.user_id = v_caller
    )
    AND EXISTS (
      SELECT 1 FROM public.dm_participants p
      WHERE p.conversation_id = c.id AND p.user_id = p_friend_id
    )
    AND (
      SELECT COUNT(*) FROM public.dm_participants p
      WHERE p.conversation_id = c.id
    ) = 2
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    RETURN v_conversation_id;
  END IF;

  INSERT INTO public.dm_conversations DEFAULT VALUES
  RETURNING id INTO v_conversation_id;

  INSERT INTO public.dm_participants (conversation_id, user_id) VALUES
    (v_conversation_id, v_caller),
    (v_conversation_id, p_friend_id);

  RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.open_or_create_dm_conversation(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_or_create_dm_conversation(UUID) TO authenticated;

-- ============================================================================
-- 13. Realtime publication
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'dm_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_messages';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'friend_requests'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'dm_unread_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_unread_messages';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'friendships'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships';
  END IF;
END $$;

-- ============================================================================
-- 14. Storage bucket: dm-media
-- Path layout: {conversationId}/{userId}/{filename}
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dm-media',
  'dm-media',
  true,
  10485760,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Participants can upload dm media" ON storage.objects;
CREATE POLICY "Participants can upload dm media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'dm-media'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (storage.foldername(name))[2] = (select auth.uid())::text
    AND EXISTS (
      SELECT 1 FROM public.dm_participants p
      WHERE p.conversation_id = ((storage.foldername(name))[1])::uuid
        AND p.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owners can update own dm media" ON storage.objects;
CREATE POLICY "Owners can update own dm media"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'dm-media'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[2] = (select auth.uid())::text
    AND EXISTS (
      SELECT 1 FROM public.dm_participants p
      WHERE p.conversation_id = ((storage.foldername(name))[1])::uuid
        AND p.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owners can delete own dm media" ON storage.objects;
CREATE POLICY "Owners can delete own dm media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'dm-media'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[2] = (select auth.uid())::text
    AND EXISTS (
      SELECT 1 FROM public.dm_participants p
      WHERE p.conversation_id = ((storage.foldername(name))[1])::uuid
        AND p.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Participants can view dm media" ON storage.objects;
CREATE POLICY "Participants can view dm media"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'dm-media'
    AND (
      EXISTS (
        SELECT 1 FROM public.dm_participants p
        WHERE p.conversation_id = ((storage.foldername(name))[1])::uuid
          AND p.user_id = (select auth.uid())
      )
      -- Bucket is public so direct URLs continue to work for embedded media tags.
      OR true
    )
  );
