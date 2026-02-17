-- Migration 091: Re-create friend_requests and friendships tables
-- Description: Re-introduces the friends feature (previously removed in migration 049)
-- Creates friend_requests, friendships tables with RLS, triggers, indexes, and realtime

-- ============================================================
-- 1. TABLES
-- ============================================================

-- Friend requests table
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  -- Prevent self-requests at the database level (defense-in-depth)
  CHECK (sender_id != receiver_id),
  -- Prevent duplicate requests in the same direction
  UNIQUE(sender_id, receiver_id)
);

-- Friendships table (canonical bidirectional relationship)
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user1_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user2_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  -- Enforce user1_id < user2_id to prevent duplicate pairs
  CHECK (user1_id < user2_id),
  UNIQUE(user1_id, user2_id)
);

-- ============================================================
-- 2. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- friend_requests policies -----------------------------------------------

-- Users can view friend requests they sent or received
DROP POLICY IF EXISTS "Users can view own friend requests" ON public.friend_requests;
CREATE POLICY "Users can view own friend requests"
  ON public.friend_requests FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can send friend requests (cannot send to themselves)
DROP POLICY IF EXISTS "Users can send friend requests" ON public.friend_requests;
CREATE POLICY "Users can send friend requests"
  ON public.friend_requests FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND auth.uid() != receiver_id);

-- Receivers can accept/reject pending friend requests
DROP POLICY IF EXISTS "Users can update received friend requests" ON public.friend_requests;
CREATE POLICY "Users can update received friend requests"
  ON public.friend_requests FOR UPDATE
  USING (auth.uid() = receiver_id AND status = 'pending')
  WITH CHECK (auth.uid() = receiver_id);

-- Senders can cancel pending requests
DROP POLICY IF EXISTS "Users can delete sent friend requests" ON public.friend_requests;
CREATE POLICY "Users can delete sent friend requests"
  ON public.friend_requests FOR DELETE
  USING (auth.uid() = sender_id AND status = 'pending');

-- friendships policies ---------------------------------------------------

-- Users can view friendships they are part of
DROP POLICY IF EXISTS "Users can view own friendships" ON public.friendships;
CREATE POLICY "Users can view own friendships"
  ON public.friendships FOR SELECT
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Users can remove friendships they are part of
DROP POLICY IF EXISTS "Users can delete own friendships" ON public.friendships;
CREATE POLICY "Users can delete own friendships"
  ON public.friendships FOR DELETE
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- ============================================================
-- 3. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON public.friend_requests(sender_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON public.friend_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON public.friend_requests(status);
CREATE INDEX IF NOT EXISTS idx_friendships_user1 ON public.friendships(user1_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user2 ON public.friendships(user2_id);

-- ============================================================
-- 4. TRIGGERS & FUNCTIONS
-- ============================================================

-- 4a. updated_at trigger (reuses existing handle_updated_at from migration 004)
DROP TRIGGER IF EXISTS on_friend_requests_updated ON public.friend_requests;
CREATE TRIGGER on_friend_requests_updated
  BEFORE UPDATE ON public.friend_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 4b. Prevent column tampering on UPDATE (only status can change, and only to accepted/rejected)
CREATE OR REPLACE FUNCTION public.restrict_friend_request_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only allow status to change
  IF NEW.sender_id != OLD.sender_id OR NEW.receiver_id != OLD.receiver_id THEN
    RAISE EXCEPTION 'Cannot modify sender_id or receiver_id';
  END IF;
  -- Only allow valid status transitions: pending -> accepted or pending -> rejected
  IF NEW.status NOT IN ('accepted', 'rejected') THEN
    RAISE EXCEPTION 'Status can only be changed to accepted or rejected';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS restrict_friend_request_update ON public.friend_requests;
CREATE TRIGGER restrict_friend_request_update
  BEFORE UPDATE ON public.friend_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.restrict_friend_request_update();

-- 4c. Prevent reverse-direction duplicate requests (if Alice->Bob exists, block Bob->Alice)
CREATE OR REPLACE FUNCTION public.prevent_reverse_friend_request()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.friend_requests
    WHERE sender_id = NEW.receiver_id
    AND receiver_id = NEW.sender_id
    AND status IN ('pending', 'accepted')
  ) THEN
    RAISE EXCEPTION 'A friend request already exists between these users';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_reverse_friend_request ON public.friend_requests;
CREATE TRIGGER prevent_reverse_friend_request
  BEFORE INSERT ON public.friend_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_reverse_friend_request();

-- 4d. Create friendship when a request is accepted
CREATE OR REPLACE FUNCTION public.create_friendship_on_accept()
RETURNS TRIGGER AS $$
DECLARE
  u1 UUID;
  u2 UUID;
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Canonical ordering: smaller UUID first
    IF NEW.sender_id < NEW.receiver_id THEN
      u1 := NEW.sender_id;
      u2 := NEW.receiver_id;
    ELSE
      u1 := NEW.receiver_id;
      u2 := NEW.sender_id;
    END IF;

    INSERT INTO public.friendships (user1_id, user2_id)
    VALUES (u1, u2)
    ON CONFLICT (user1_id, user2_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS create_friendship_on_accept ON public.friend_requests;
CREATE TRIGGER create_friendship_on_accept
  AFTER UPDATE ON public.friend_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.create_friendship_on_accept();

-- 4e. Delete friendship when a request is rejected (or un-accepted)
CREATE OR REPLACE FUNCTION public.delete_friendship_on_reject()
RETURNS TRIGGER AS $$
DECLARE
  u1 UUID;
  u2 UUID;
BEGIN
  IF NEW.status = 'rejected' OR (OLD.status = 'accepted' AND NEW.status != 'accepted') THEN
    IF OLD.sender_id < OLD.receiver_id THEN
      u1 := OLD.sender_id;
      u2 := OLD.receiver_id;
    ELSE
      u1 := OLD.receiver_id;
      u2 := OLD.sender_id;
    END IF;

    DELETE FROM public.friendships
    WHERE user1_id = u1 AND user2_id = u2;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS delete_friendship_on_reject ON public.friend_requests;
CREATE TRIGGER delete_friendship_on_reject
  AFTER UPDATE ON public.friend_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_friendship_on_reject();

-- ============================================================
-- 5. PROFILES RLS — allow all authenticated users to view basic info
-- ============================================================
-- Migration 061 already adds "Users can view profile usernames" policy
-- allowing auth.uid() IS NOT NULL. Verify it exists; if not, create it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles'
    AND schemaname = 'public'
    AND policyname = 'Users can view profile usernames'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can view profile usernames"
        ON public.profiles FOR SELECT
        USING (auth.uid() IS NOT NULL)
    $policy$;
  END IF;
END $$;

-- ============================================================
-- 6. ENABLE REALTIME
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'friend_requests'
    AND schemaname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'friendships'
    AND schemaname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
  END IF;
END $$;

-- ============================================================
-- 7. COMMENTS
-- ============================================================

COMMENT ON TABLE public.friend_requests IS 'Stores friend requests between users with pending/accepted/rejected status';
COMMENT ON TABLE public.friendships IS 'Stores accepted friendships as canonical pairs (user1_id < user2_id)';
