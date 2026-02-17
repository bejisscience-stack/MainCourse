import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface UseRealtimeFriendsOptions {
  userId: string | null;
  enabled?: boolean;
  onFriendRequestChange?: () => void;
  onFriendshipChange?: () => void;
}

export function useRealtimeFriends({
  userId,
  enabled = true,
  onFriendRequestChange,
  onFriendshipChange,
}: UseRealtimeFriendsOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const subscriptionRef = useRef<any>(null);
  const callbacksRef = useRef({ onFriendRequestChange, onFriendshipChange });

  // Keep callbacks fresh
  useEffect(() => {
    callbacksRef.current = { onFriendRequestChange, onFriendshipChange };
  }, [onFriendRequestChange, onFriendshipChange]);

  useEffect(() => {
    if (!enabled || !userId) {
      setIsConnected(false);
      return;
    }

    const channel = supabase
      .channel(`friends:${userId}`, {
        config: {
          broadcast: { self: false },
          presence: { key: '' },
        },
      })
      // Friend requests where user is sender
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friend_requests',
          filter: `sender_id=eq.${userId}`,
        },
        () => {
          callbacksRef.current.onFriendRequestChange?.();
        }
      )
      // Friend requests where user is receiver
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friend_requests',
          filter: `receiver_id=eq.${userId}`,
        },
        () => {
          callbacksRef.current.onFriendRequestChange?.();
        }
      )
      // Friendships where user is user1
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `user1_id=eq.${userId}`,
        },
        () => {
          callbacksRef.current.onFriendshipChange?.();
        }
      )
      // Friendships where user is user2
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `user2_id=eq.${userId}`,
        },
        () => {
          callbacksRef.current.onFriendshipChange?.();
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') {
          console.log(`[RT] Connected to friends channel for ${userId}`);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.warn(`[RT] Disconnected from friends channel: ${status}`);
        }
      });

    subscriptionRef.current = channel;

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
      setIsConnected(false);
    };
  }, [userId, enabled]);

  return { isConnected };
}
