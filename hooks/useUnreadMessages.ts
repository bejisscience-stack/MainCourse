import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

interface UseUnreadMessagesOptions {
  channelIds: string[];
  enabled?: boolean;
}

export function useUnreadMessages({ channelIds, enabled = true }: UseUnreadMessagesOptions) {
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  // Memoize channelIds to prevent unnecessary re-renders when array reference changes but content is the same
  const memoizedChannelIds = useMemo(() => channelIds, [JSON.stringify(channelIds)]);

  const fetchUnreadCounts = useCallback(async () => {
    if (!enabled || memoizedChannelIds.length === 0) {
      setUnreadCounts(new Map());
      return;
    }

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsLoading(false);
        return;
      }

      const counts = new Map<string, number>();
      
      // Fetch unread counts for all channels
      const promises = memoizedChannelIds.map(async (channelId) => {
        try {
          const response = await fetch(`/api/chats/${channelId}/unread`, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            counts.set(channelId, data.unreadCount || 0);
          }
        } catch (error) {
          console.warn(`Failed to fetch unread count for channel ${channelId}:`, error);
          counts.set(channelId, 0);
        }
      });

      await Promise.all(promises);
      setUnreadCounts(counts);
    } catch (error) {
      console.error('Error fetching unread counts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [memoizedChannelIds, enabled]);

  // Initial fetch
  useEffect(() => {
    fetchUnreadCounts();
  }, [fetchUnreadCounts]);

  // Subscribe to real-time updates for unread counts
  useEffect(() => {
    if (!enabled || memoizedChannelIds.length === 0) return;

    // Create a single channel for all unread updates
    const channel = supabase
      .channel('unread-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'unread_messages',
        },
        (payload) => {
          // Check if the update is for one of our channels
          if (payload.new && 'channel_id' in payload.new) {
            const updatedChannelId = (payload.new as any).channel_id;
            if (memoizedChannelIds.includes(updatedChannelId)) {
              // Refetch unread counts when they change
              fetchUnreadCounts();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [memoizedChannelIds, enabled, fetchUnreadCounts]);

  return {
    unreadCounts,
    isLoading,
    refetch: fetchUnreadCounts,
    getUnreadCount: (channelId: string) => unreadCounts.get(channelId) || 0,
  };
}

