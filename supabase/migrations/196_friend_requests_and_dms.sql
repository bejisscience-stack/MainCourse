-- ============================================================
-- Migration 196: Friend Requests, Blocked Users & Direct Messages
-- ============================================================
-- Adds friend request system, blocking, and 1-on-1 DM channels
-- that reuse the same message features as course chat.
-- ============================================================

-- ==================== TABLES ====================

-- 1. Friend Requests
CREATE TABLE IF NOT EXISTS friend_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sender_id, receiver_id)
);

-- 2. Friendships (denormalized for fast lookups — one row per pair)
CREATE TABLE IF NOT EXISTS friendships (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, friend_id)
);

-- 3. Blocked Users
CREATE TABLE IF NOT EXISTS blocked_users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);

-- 4. DM Channels (one per user pair, sorted IDs ensure uniqueness)
CREATE TABLE IF NOT EXISTS dm_channels (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dm_channels_sorted CHECK (user1_id < user2_id),
  UNIQUE (user1_id, user2_id)
);

-- 5. DM Messages
CREATE TABLE IF NOT EXISTS dm_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dm_channel_id uuid NOT NULL REFERENCES dm_channels(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content      text,
  reply_to_id  uuid REFERENCES dm_messages(id) ON DELETE SET NULL,
  edited_at    timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 6. DM Message Attachments
CREATE TABLE IF NOT EXISTS dm_message_attachments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id    uuid NOT NULL REFERENCES dm_messages(id) ON DELETE CASCADE,
  dm_channel_id uuid NOT NULL REFERENCES dm_channels(id) ON DELETE CASCADE,
  file_url      text NOT NULL,
  file_name     text NOT NULL DEFAULT 'attachment',
  file_type     text NOT NULL DEFAULT 'image',
  file_size     bigint NOT NULL DEFAULT 0,
  mime_type     text NOT NULL DEFAULT 'application/octet-stream',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 7. DM Typing Indicators
CREATE TABLE IF NOT EXISTS dm_typing_indicators (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dm_channel_id uuid NOT NULL REFERENCES dm_channels(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '3 seconds'),
  UNIQUE (dm_channel_id, user_id)
);

-- 8. DM Unread Messages
CREATE TABLE IF NOT EXISTS dm_unread_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dm_channel_id uuid NOT NULL REFERENCES dm_channels(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at  timestamptz NOT NULL DEFAULT now(),
  unread_count  integer NOT NULL DEFAULT 0,
  UNIQUE (dm_channel_id, user_id)
);

-- ==================== INDEXES ====================

CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON friend_requests(receiver_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender   ON friend_requests(sender_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user         ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend       ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker    ON blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked    ON blocked_users(blocked_id);
CREATE INDEX IF NOT EXISTS idx_dm_channels_user1        ON dm_channels(user1_id);
CREATE INDEX IF NOT EXISTS idx_dm_channels_user2        ON dm_channels(user2_id);
CREATE INDEX IF NOT EXISTS idx_dm_messages_channel      ON dm_messages(dm_channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_messages_user         ON dm_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_dm_message_attachments_msg ON dm_message_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_dm_typing_channel        ON dm_typing_indicators(dm_channel_id);
CREATE INDEX IF NOT EXISTS idx_dm_unread_user           ON dm_unread_messages(user_id);

-- ==================== HELPER FUNCTIONS ====================

CREATE OR REPLACE FUNCTION are_friends(uid1 uuid, uid2 uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM friendships
    WHERE (user_id = uid1 AND friend_id = uid2)
       OR (user_id = uid2 AND friend_id = uid1)
  );
$$;

CREATE OR REPLACE FUNCTION is_blocked(blocker uuid, blocked_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM blocked_users
    WHERE blocker_id = blocker AND blocked_id = blocked_user
  );
$$;

CREATE OR REPLACE FUNCTION can_dm_user(sender uuid, receiver uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  sender_role text;
BEGIN
  SELECT role INTO sender_role FROM profiles WHERE id = sender;
  IF sender_role IN ('admin', 'lecturer') THEN
    RETURN true;
  END IF;
  IF is_blocked(receiver, sender) OR is_blocked(sender, receiver) THEN
    RETURN false;
  END IF;
  RETURN are_friends(sender, receiver);
END;
$$;

CREATE OR REPLACE FUNCTION get_or_create_dm_channel(uid1 uuid, uid2 uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  sorted_user1 uuid;
  sorted_user2 uuid;
  channel_id uuid;
BEGIN
  IF uid1 < uid2 THEN
    sorted_user1 := uid1;
    sorted_user2 := uid2;
  ELSE
    sorted_user1 := uid2;
    sorted_user2 := uid1;
  END IF;

  SELECT id INTO channel_id
  FROM dm_channels
  WHERE user1_id = sorted_user1 AND user2_id = sorted_user2;

  IF channel_id IS NULL THEN
    INSERT INTO dm_channels (user1_id, user2_id)
    VALUES (sorted_user1, sorted_user2)
    RETURNING id INTO channel_id;

    INSERT INTO dm_unread_messages (dm_channel_id, user_id, unread_count)
    VALUES (channel_id, uid1, 0), (channel_id, uid2, 0)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN channel_id;
END;
$$;

CREATE OR REPLACE FUNCTION accept_friend_request(request_id uuid, accepting_user uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  req record;
BEGIN
  SELECT * INTO req FROM friend_requests
  WHERE id = request_id AND receiver_id = accepting_user AND status = 'pending';

  IF req IS NULL THEN
    RETURN false;
  END IF;

  UPDATE friend_requests SET status = 'accepted', updated_at = now()
  WHERE id = request_id;

  INSERT INTO friendships (user_id, friend_id)
  VALUES (req.sender_id, req.receiver_id), (req.receiver_id, req.sender_id)
  ON CONFLICT DO NOTHING;

  UPDATE friend_requests SET status = 'accepted', updated_at = now()
  WHERE sender_id = accepting_user AND receiver_id = req.sender_id AND status = 'pending';

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION send_friend_request(sender uuid, receiver uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  existing_request record;
  new_request record;
BEGIN
  IF sender = receiver THEN
    RETURN jsonb_build_object('error', 'Cannot send friend request to yourself');
  END IF;

  IF is_blocked(receiver, sender) THEN
    RETURN jsonb_build_object('status', 'sent');
  END IF;

  IF is_blocked(sender, receiver) THEN
    RETURN jsonb_build_object('error', 'Cannot send request to this user');
  END IF;

  IF are_friends(sender, receiver) THEN
    RETURN jsonb_build_object('error', 'Already friends');
  END IF;

  SELECT * INTO existing_request FROM friend_requests
  WHERE sender_id = sender AND receiver_id = receiver AND status = 'pending';

  IF existing_request IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'Request already sent');
  END IF;

  SELECT * INTO existing_request FROM friend_requests
  WHERE sender_id = receiver AND receiver_id = sender AND status = 'pending';

  IF existing_request IS NOT NULL THEN
    PERFORM accept_friend_request(existing_request.id, sender);
    RETURN jsonb_build_object('status', 'auto_accepted');
  END IF;

  INSERT INTO friend_requests (sender_id, receiver_id)
  VALUES (sender, receiver)
  RETURNING * INTO new_request;

  RETURN jsonb_build_object('status', 'sent', 'id', new_request.id);
END;
$$;

CREATE OR REPLACE FUNCTION unfriend_user(uid uuid, friend uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF uid != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM friendships
  WHERE (user_id = uid AND friend_id = friend)
     OR (user_id = friend AND friend_id = uid);

  DELETE FROM friend_requests
  WHERE (sender_id = uid AND receiver_id = friend)
     OR (sender_id = friend AND receiver_id = uid);

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION block_user_action(blocker uuid, target uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF blocker != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO blocked_users (blocker_id, blocked_id)
  VALUES (blocker, target)
  ON CONFLICT DO NOTHING;

  DELETE FROM friendships
  WHERE (user_id = blocker AND friend_id = target)
     OR (user_id = target AND friend_id = blocker);

  UPDATE friend_requests SET status = 'rejected', updated_at = now()
  WHERE ((sender_id = blocker AND receiver_id = target)
     OR  (sender_id = target AND receiver_id = blocker))
    AND status = 'pending';

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION increment_dm_unread(p_channel_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO dm_unread_messages (dm_channel_id, user_id, unread_count)
  VALUES (p_channel_id, p_user_id, 1)
  ON CONFLICT (dm_channel_id, user_id)
  DO UPDATE SET unread_count = dm_unread_messages.unread_count + 1;
END;
$$;

CREATE OR REPLACE FUNCTION reset_dm_unread(p_channel_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE dm_unread_messages
  SET unread_count = 0, last_read_at = now()
  WHERE dm_channel_id = p_channel_id AND user_id = p_user_id;
END;
$$;

-- ==================== TRIGGERS ====================

CREATE OR REPLACE FUNCTION trigger_dm_message_unread()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  other_user uuid;
  ch record;
BEGIN
  SELECT user1_id, user2_id INTO ch FROM dm_channels WHERE id = NEW.dm_channel_id;
  IF ch.user1_id = NEW.user_id THEN
    other_user := ch.user2_id;
  ELSE
    other_user := ch.user1_id;
  END IF;

  PERFORM increment_dm_unread(NEW.dm_channel_id, other_user);
  RETURN NEW;
END;
$$;

CREATE TRIGGER dm_message_unread_trigger
  AFTER INSERT ON dm_messages
  FOR EACH ROW
  EXECUTE FUNCTION trigger_dm_message_unread();

CREATE OR REPLACE FUNCTION cleanup_dm_typing()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM dm_typing_indicators WHERE expires_at < now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER dm_typing_cleanup_trigger
  BEFORE INSERT ON dm_typing_indicators
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_dm_typing();

-- ==================== RLS POLICIES ====================

ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_typing_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_unread_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY friend_requests_select ON friend_requests FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY friend_requests_insert ON friend_requests FOR INSERT
  WITH CHECK (auth.uid() = sender_id);
CREATE POLICY friend_requests_update ON friend_requests FOR UPDATE
  USING (auth.uid() = receiver_id AND status = 'pending');

CREATE POLICY friendships_select ON friendships FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY blocked_users_select ON blocked_users FOR SELECT
  USING (auth.uid() = blocker_id);
CREATE POLICY blocked_users_insert ON blocked_users FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY blocked_users_delete ON blocked_users FOR DELETE
  USING (auth.uid() = blocker_id);

CREATE POLICY dm_channels_select ON dm_channels FOR SELECT
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY dm_channels_insert ON dm_channels FOR INSERT
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY dm_messages_select ON dm_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dm_channels
      WHERE dm_channels.id = dm_messages.dm_channel_id
        AND (dm_channels.user1_id = auth.uid() OR dm_channels.user2_id = auth.uid())
    )
  );
CREATE POLICY dm_messages_insert ON dm_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM dm_channels
      WHERE dm_channels.id = dm_channel_id
        AND (dm_channels.user1_id = auth.uid() OR dm_channels.user2_id = auth.uid())
    )
  );
CREATE POLICY dm_messages_update ON dm_messages FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY dm_messages_delete ON dm_messages FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY dm_message_attachments_select ON dm_message_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dm_channels
      WHERE dm_channels.id = dm_message_attachments.dm_channel_id
        AND (dm_channels.user1_id = auth.uid() OR dm_channels.user2_id = auth.uid())
    )
  );
CREATE POLICY dm_message_attachments_insert ON dm_message_attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dm_channels
      WHERE dm_channels.id = dm_channel_id
        AND (dm_channels.user1_id = auth.uid() OR dm_channels.user2_id = auth.uid())
    )
  );

CREATE POLICY dm_typing_select ON dm_typing_indicators FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dm_channels
      WHERE dm_channels.id = dm_typing_indicators.dm_channel_id
        AND (dm_channels.user1_id = auth.uid() OR dm_channels.user2_id = auth.uid())
    )
  );
CREATE POLICY dm_typing_insert ON dm_typing_indicators FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY dm_typing_update ON dm_typing_indicators FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY dm_typing_delete ON dm_typing_indicators FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY dm_unread_select ON dm_unread_messages FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY dm_unread_update ON dm_unread_messages FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY dm_unread_insert ON dm_unread_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ==================== REALTIME ====================

ALTER PUBLICATION supabase_realtime ADD TABLE dm_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE dm_typing_indicators;
ALTER PUBLICATION supabase_realtime ADD TABLE friend_requests;

-- ==================== PERMISSIONS ====================

-- Read-only helpers: grant to anon (edge functions use anon key with verify_jwt:false)
GRANT EXECUTE ON FUNCTION are_friends(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_blocked(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION can_dm_user(uuid, uuid) TO authenticated, anon;

-- Mutation functions: anon needed for edge functions (they authenticate via getAuthenticatedUser)
GRANT EXECUTE ON FUNCTION get_or_create_dm_channel(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION accept_friend_request(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION send_friend_request(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION unfriend_user(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION block_user_action(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION increment_dm_unread(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION reset_dm_unread(uuid, uuid) TO authenticated, anon;
