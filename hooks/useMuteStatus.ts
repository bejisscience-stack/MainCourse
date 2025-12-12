import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface UseMuteStatusOptions {
  channelId: string | null;
  userId: string | null;
  enabled?: boolean;
}

export function useMuteStatus({ channelId, userId, enabled = true }: UseMuteStatusOptions) {
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const subscriptionRef = useRef<any>(null);

  // Fetch current mute status
  const fetchMuteStatus = useCallback(async () => {
    if (!channelId || !userId || !enabled) {
      setIsMuted(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsMuted(false);
        return;
      }

      const response = await fetch(`/api/chats/${channelId}/mute?userId=${userId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setIsMuted(data.muted || false);
      } else {
        setIsMuted(false);
      }
    } catch (error) {
      console.warn('Failed to check mute status:', error);
      setIsMuted(false);
    } finally {
      setIsLoading(false);
    }
  }, [channelId, userId, enabled]);

  // Subscribe to real-time mute status changes
  useEffect(() => {
    if (!channelId || !userId || !enabled) {
      setIsMuted(false);
      return;
    }

    // Initial fetch
    fetchMuteStatus();

    // Subscribe to mute changes
    const channel = supabase
      .channel(`mute:${channelId}:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'muted_users',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const record = payload.new as { user_id?: string } | null;
          const oldRecord = payload.old as { user_id?: string } | null;
          const affectedUserId = record?.user_id || oldRecord?.user_id;

          if (affectedUserId === userId) {
            if (payload.eventType === 'INSERT') {
              setIsMuted(true);
            } else if (payload.eventType === 'DELETE') {
              setIsMuted(false);
            }
          }
        }
      )
      .subscribe();

    subscriptionRef.current = channel;

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [channelId, userId, enabled, fetchMuteStatus]);

  // Mute a user (for lecturers)
  const muteUser = useCallback(async (targetUserId: string) => {
    if (!channelId) return false;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const response = await fetch(`/api/chats/${channelId}/mute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId: targetUserId }),
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to mute user:', error);
      return false;
    }
  }, [channelId]);

  // Unmute a user (for lecturers)
  const unmuteUser = useCallback(async (targetUserId: string) => {
    if (!channelId) return false;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const response = await fetch(`/api/chats/${channelId}/mute?userId=${targetUserId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to unmute user:', error);
      return false;
    }
  }, [channelId]);

  return {
    isMuted,
    isLoading,
    muteUser,
    unmuteUser,
    refetch: fetchMuteStatus,
  };
}

// Hook for checking if a specific user is muted (for lecturers viewing other users)
export function useUserMuteStatus(channelId: string | null, targetUserId: string | null) {
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const checkMuteStatus = useCallback(async () => {
    if (!channelId || !targetUserId) {
      setIsMuted(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsMuted(false);
        return;
      }

      const response = await fetch(`/api/chats/${channelId}/mute?userId=${targetUserId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setIsMuted(data.muted || false);
      }
    } catch (error) {
      console.warn('Failed to check user mute status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [channelId, targetUserId]);

  useEffect(() => {
    checkMuteStatus();
  }, [checkMuteStatus]);

  return { isMuted, isLoading, refetch: checkMuteStatus };
}

