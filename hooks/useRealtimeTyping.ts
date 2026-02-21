import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { getCachedUsername, prefetchProfiles } from './useRealtimeMessages';

interface TypingUser {
  userId: string;
  username: string;
  expiresAt: number;
}

interface UseRealtimeTypingOptions {
  channelId: string | null;
  currentUserId: string;
  enabled?: boolean;
}

// Typing indicator TTL (5 seconds)
const TYPING_TTL = 5000;

export function useRealtimeTyping({
  channelId,
  currentUserId,
  enabled = true,
}: UseRealtimeTypingOptions) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const subscriptionRef = useRef<any>(null);
  const cleanupIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastChannelIdRef = useRef<string | null>(null);

  // Clean up expired typing indicators
  useEffect(() => {
    if (!enabled || !channelId) return;

    const cleanup = () => {
      const now = Date.now();
      setTypingUsers((prev) => {
        const filtered = prev.filter((user) => user.expiresAt > now);
        return filtered.length !== prev.length ? filtered : prev;
      });
    };

    cleanupIntervalRef.current = setInterval(cleanup, 1000);

    return () => {
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
        cleanupIntervalRef.current = null;
      }
    };
  }, [channelId, enabled]);

  // Clear typing users when channel changes
  useEffect(() => {
    if (lastChannelIdRef.current !== channelId) {
      setTypingUsers([]);
      lastChannelIdRef.current = channelId;
    }
  }, [channelId]);

  useEffect(() => {
    if (!enabled || !channelId) {
      setTypingUsers([]);
      return;
    }

    // Subscribe to typing indicators
    const channel = supabase
      .channel(`typing:${channelId}`, {
        config: {
          broadcast: { self: false },
        }
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          const newRecord = payload.new as { user_id?: string; expires_at?: string } | null;
          const oldRecord = payload.old as { user_id?: string } | null;
          const userId = newRecord?.user_id || oldRecord?.user_id;

          // Don't show current user's typing indicator
          if (!userId || userId === currentUserId) return;

          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            // Try to get username from cache first (instant)
            let username = getCachedUsername(userId);
            
            // If not cached, fetch it
            if (username === 'User') {
              await prefetchProfiles([userId]);
              username = getCachedUsername(userId);
            }

            const expiresAt = newRecord?.expires_at 
              ? new Date(newRecord.expires_at).getTime()
              : Date.now() + TYPING_TTL;

            setTypingUsers((prev) => {
              const filtered = prev.filter((u) => u.userId !== userId);
              return [...filtered, { userId, username, expiresAt }];
            });
          } else if (payload.eventType === 'DELETE') {
            setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
          }
        }
      )
      .subscribe();

    subscriptionRef.current = channel;

    // Fetch current typing indicators on mount
    const fetchCurrentTyping = async () => {
      try {
        const { data, error } = await supabase
          .from('typing_indicators')
          .select('user_id, expires_at')
          .eq('channel_id', channelId)
          .gt('expires_at', new Date().toISOString());

        if (error || !data || data.length === 0) {
          setTypingUsers([]);
          return;
        }

        const userIds = data
          .map((item) => item.user_id)
          .filter((id) => id !== currentUserId);

        if (userIds.length === 0) {
          setTypingUsers([]);
          return;
        }

        // Prefetch profiles
        await prefetchProfiles(userIds);

        const users: TypingUser[] = data
          .filter((item) => item.user_id !== currentUserId)
          .map((item) => ({
            userId: item.user_id,
            username: getCachedUsername(item.user_id),
            expiresAt: new Date(item.expires_at).getTime(),
          }));

        setTypingUsers(users);
      } catch (err) {
        console.warn('Error fetching typing indicators:', err);
        setTypingUsers([]);
      }
    };

    fetchCurrentTyping();

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [channelId, currentUserId, enabled]);

  // Memoize the return value to prevent unnecessary re-renders
  const stableTypingUsers = useMemo(() => typingUsers, [typingUsers]);

  return { typingUsers: stableTypingUsers };
}
