-- Migration: Create friend_requests and friendships tables
-- Description: Enables users to send friend requests and maintain friendships

-- Friend requests table
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE(sender_id, receiver_id)
);

-- Friendships table (bidirectional relationship)
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user1_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user2_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  -- Ensure user1_id < user2_id to prevent duplicates
  CHECK (user1_id < user2_id),
  UNIQUE(user1_id, user2_id)
);

-- Enable Row Level Security
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS friend_requests_sender_idx ON public.friend_requests(sender_id);
CREATE INDEX IF NOT EXISTS friend_requests_receiver_idx ON public.friend_requests(receiver_id);
CREATE INDEX IF NOT EXISTS friend_requests_status_idx ON public.friend_requests(status);
CREATE INDEX IF NOT EXISTS friendships_user1_idx ON public.friendships(user1_id);
CREATE INDEX IF NOT EXISTS friendships_user2_idx ON public.friendships(user2_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_friend_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
CREATE TRIGGER update_friend_requests_updated_at
  BEFORE UPDATE ON public.friend_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_friend_requests_updated_at();

-- Function to create friendship when request is accepted
CREATE OR REPLACE FUNCTION public.create_friendship_on_accept()
RETURNS TRIGGER AS $$
DECLARE
  user1 UUID;
  user2 UUID;
BEGIN
  -- Only process when status changes to 'accepted'
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Ensure user1_id < user2_id for consistency
    IF NEW.sender_id < NEW.receiver_id THEN
      user1 := NEW.sender_id;
      user2 := NEW.receiver_id;
    ELSE
      user1 := NEW.receiver_id;
      user2 := NEW.sender_id;
    END IF;

    -- Insert friendship (ignore if already exists)
    INSERT INTO public.friendships (user1_id, user2_id)
    VALUES (user1, user2)
    ON CONFLICT (user1_id, user2_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create friendship when request is accepted
CREATE TRIGGER create_friendship_on_accept
  AFTER UPDATE ON public.friend_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.create_friendship_on_accept();

-- Function to delete friendship when request is rejected or deleted
CREATE OR REPLACE FUNCTION public.delete_friendship_on_reject()
RETURNS TRIGGER AS $$
DECLARE
  user1 UUID;
  user2 UUID;
BEGIN
  -- If status changes to rejected, remove friendship if exists
  IF NEW.status = 'rejected' OR (OLD.status = 'accepted' AND NEW.status != 'accepted') THEN
    -- Ensure user1_id < user2_id for consistency
    IF OLD.sender_id < OLD.receiver_id THEN
      user1 := OLD.sender_id;
      user2 := OLD.receiver_id;
    ELSE
      user1 := OLD.receiver_id;
      user2 := OLD.sender_id;
    END IF;

    -- Delete friendship
    DELETE FROM public.friendships
    WHERE (user1_id = user1 AND user2_id = user2)
       OR (user1_id = user2 AND user2_id = user1);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to delete friendship when request is rejected
CREATE TRIGGER delete_friendship_on_reject
  AFTER UPDATE ON public.friend_requests
  FOR EACH ROW
  WHEN (OLD.status = 'accepted' AND NEW.status != 'accepted')
  EXECUTE FUNCTION public.delete_friendship_on_reject();

-- RLS Policies for friend_requests

-- Users can view friend requests they sent or received
DROP POLICY IF EXISTS "Users can view own friend requests" ON public.friend_requests;
CREATE POLICY "Users can view own friend requests"
  ON public.friend_requests FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can send friend requests
DROP POLICY IF EXISTS "Users can send friend requests" ON public.friend_requests;
CREATE POLICY "Users can send friend requests"
  ON public.friend_requests FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND auth.uid() != receiver_id);

-- Users can update friend requests they received (to accept/reject)
DROP POLICY IF EXISTS "Users can update received friend requests" ON public.friend_requests;
CREATE POLICY "Users can update received friend requests"
  ON public.friend_requests FOR UPDATE
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

-- Users can delete friend requests they sent (to cancel)
DROP POLICY IF EXISTS "Users can delete sent friend requests" ON public.friend_requests;
CREATE POLICY "Users can delete sent friend requests"
  ON public.friend_requests FOR DELETE
  USING (auth.uid() = sender_id AND status = 'pending');

-- RLS Policies for friendships

-- Users can view friendships they are part of
DROP POLICY IF EXISTS "Users can view own friendships" ON public.friendships;
CREATE POLICY "Users can view own friendships"
  ON public.friendships FOR SELECT
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Users can delete friendships they are part of (to remove friend)
DROP POLICY IF EXISTS "Users can delete own friendships" ON public.friendships;
CREATE POLICY "Users can delete own friendships"
  ON public.friendships FOR DELETE
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

COMMENT ON TABLE public.friend_requests IS 'Stores friend requests between users';
COMMENT ON TABLE public.friendships IS 'Stores accepted friendships between users (bidirectional)';



