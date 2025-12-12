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

  // Fetch current mute status from API (handles lecturer-wise logic server-side)
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
  // Listen for changes where this user is affected (user_id matches)
  useEffect(() => {
    if (!channelId || !userId || !enabled) {
      setIsMuted(false);
      return;
    }

    // Initial fetch
    fetchMuteStatus();

    // Subscribe to mute changes for this specific user
    // The mute is now lecturer-wise, so we listen for any mute record affecting this user
    const channel = supabase
      .channel(`mute_status:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'muted_users',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          // When any mute record changes for this user, re-fetch to check status
          // This handles the lecturer-wise muting since we need to check if the
          // mute affects the current channel's lecturer
          fetchMuteStatus();
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

  // Mute a user (for lecturers) - mutes across ALL lecturer's channels
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

      if (response.ok) {
        const data = await response.json();
        console.log('User muted:', data.message);
      }

      return response.ok;
    } catch (error) {
      console.error('Failed to mute user:', error);
      return false;
    }
  }, [channelId]);

  // Unmute a user (for lecturers) - unmutes across ALL lecturer's channels
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

      if (response.ok) {
        const data = await response.json();
        console.log('User unmuted:', data.message);
      }

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
  const subscriptionRef = useRef<any>(null);

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
    if (!channelId || !targetUserId) return;
    
    checkMuteStatus();

    // Subscribe to mute changes for this target user
    const channel = supabase
      .channel(`user_mute_status:${targetUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'muted_users',
          filter: `user_id=eq.${targetUserId}`,
        },
        () => {
          checkMuteStatus();
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
  }, [channelId, targetUserId, checkMuteStatus]);

  return { isMuted, isLoading, refetch: checkMuteStatus };
}
