-- Migration: Enable Realtime for friend_requests table
-- Description: Enables Supabase Realtime for the friend_requests table so users receive live updates
-- This is REQUIRED for real-time friend request notifications to work

-- Enable replication for friend_requests table (required for real-time)
-- Only add if not already in the publication (with error handling)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'friend_requests'
    AND schemaname = 'public'
  ) THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
      RAISE NOTICE 'Added friend_requests to supabase_realtime publication';
    EXCEPTION
      WHEN duplicate_object THEN
        RAISE NOTICE 'friend_requests is already in supabase_realtime publication (caught duplicate_object)';
      WHEN OTHERS THEN
        -- If it's already a member, that's fine - just log and continue
        IF SQLSTATE = '42710' THEN
          RAISE NOTICE 'friend_requests is already in supabase_realtime publication (caught 42710)';
        ELSE
          RAISE;
        END IF;
    END;
  ELSE
    RAISE NOTICE 'friend_requests is already in supabase_realtime publication (checked)';
  END IF;
END $$;

-- Also enable for friendships table (for when requests are accepted)
-- Only add if not already in the publication (with error handling)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'friendships'
    AND schemaname = 'public'
  ) THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
      RAISE NOTICE 'Added friendships to supabase_realtime publication';
    EXCEPTION
      WHEN duplicate_object THEN
        RAISE NOTICE 'friendships is already in supabase_realtime publication (caught duplicate_object)';
      WHEN OTHERS THEN
        -- If it's already a member, that's fine - just log and continue
        IF SQLSTATE = '42710' THEN
          RAISE NOTICE 'friendships is already in supabase_realtime publication (caught 42710)';
        ELSE
          RAISE;
        END IF;
    END;
  ELSE
    RAISE NOTICE 'friendships is already in supabase_realtime publication (checked)';
  END IF;
END $$;

-- Verify replication is enabled
-- You can check this by running:
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename IN ('friend_requests', 'friendships');

COMMENT ON TABLE public.friend_requests IS 
  'Stores friend requests between users. Realtime enabled for live notifications.';

COMMENT ON TABLE public.friendships IS 
  'Stores accepted friendships between users. Realtime enabled for live updates.';

