import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

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

export function useRealtimeTyping({
  channelId,
  currentUserId,
  enabled = true,
}: UseRealtimeTypingOptions) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const subscriptionRef = useRef<any>(null);
  const cleanupIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up expired typing indicators
  useEffect(() => {
    if (!enabled || !channelId) return;

    const cleanup = () => {
      const now = Date.now();
      setTypingUsers((prev) =>
        prev.filter((user) => user.expiresAt > now)
      );
    };

    cleanupIntervalRef.current = setInterval(cleanup, 1000);

    return () => {
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }
    };
  }, [channelId, enabled]);

  useEffect(() => {
    if (!enabled || !channelId) {
      setTypingUsers([]);
      return;
    }

    // Subscribe to typing indicators
    const channel = supabase
      .channel(`typing:${channelId}`)
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
            // Fetch user profile
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .eq('id', userId)
              .single();

            const username = profile?.full_name || profile?.email?.split('@')[0] || 'User';
            const expiresAt = newRecord?.expires_at ? new Date(newRecord.expires_at).getTime() : Date.now();

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

    // Also fetch current typing indicators
    const fetchCurrentTyping = async () => {
      const { data, error } = await supabase
        .from('typing_indicators')
        .select('user_id, expires_at')
        .eq('channel_id', channelId)
        .gt('expires_at', new Date().toISOString());
      
      if (error) {
        console.warn('Error fetching typing indicators:', error);
        return;
      }
      
      // Fetch profiles separately if we have user IDs
      if (data && data.length > 0) {
        const userIds = data.map((item) => item.user_id).filter((id) => id !== currentUserId);
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', userIds);
          
          const profileMap = new Map();
          if (profiles) {
            profiles.forEach((profile) => {
              profileMap.set(profile.id, profile);
            });
          }
          
          const users: TypingUser[] = data
            .filter((item) => item.user_id !== currentUserId)
            .map((item) => {
              const profile = profileMap.get(item.user_id);
              return {
                userId: item.user_id,
                username: profile?.full_name || profile?.email?.split('@')[0] || 'User',
                expiresAt: new Date(item.expires_at).getTime(),
              };
            });
          
          setTypingUsers(users);
        } else {
          setTypingUsers([]);
        }
      } else {
        setTypingUsers([]);
      }
    };

    fetchCurrentTyping();

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
      setTypingUsers([]);
    };
  }, [channelId, currentUserId, enabled]);

  return { typingUsers };
}
