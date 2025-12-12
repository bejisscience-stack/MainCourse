import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface UseUnreadMessagesOptions {
  channelIds: string[];
  enabled?: boolean;
}

interface UnreadState {
  counts: Map<string, number>;
  lastUpdate: number;
}

// Global cache for unread counts to prevent redundant fetches
const unreadCache = new Map<string, { count: number; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

export function useUnreadMessages({ channelIds, enabled = true }: UseUnreadMessagesOptions) {
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const subscriptionRef = useRef<any>(null);
  const fetchControllerRef = useRef<AbortController | null>(null);
  
  // Memoize channel IDs to prevent unnecessary re-subscriptions
  const stableChannelIds = useMemo(() => {
    const sorted = [...channelIds].sort();
    return sorted;
  }, [channelIds.join(',')]);

  // Fetch unread counts with caching
  const fetchUnreadCounts = useCallback(async (forceRefresh = false) => {
    if (!enabled || stableChannelIds.length === 0) {
      setUnreadCounts(new Map());
      return;
    }

    // Cancel any pending fetch
    if (fetchControllerRef.current) {
      fetchControllerRef.current.abort();
    }
    fetchControllerRef.current = new AbortController();

    const now = Date.now();
    const counts = new Map<string, number>();
    const channelsToFetch: string[] = [];

    // Check cache first
    for (const channelId of stableChannelIds) {
      const cached = unreadCache.get(channelId);
      if (cached && !forceRefresh && (now - cached.timestamp < CACHE_TTL)) {
        counts.set(channelId, cached.count);
      } else {
        channelsToFetch.push(channelId);
      }
    }

    // If all cached, just update state
    if (channelsToFetch.length === 0) {
      setUnreadCounts(counts);
      return;
    }

    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsLoading(false);
        return;
      }

      // Batch fetch unread counts
      const promises = channelsToFetch.map(async (channelId) => {
        try {
          const response = await fetch(`/api/chats/${channelId}/unread`, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
            signal: fetchControllerRef.current?.signal,
          });

          if (response.ok) {
            const data = await response.json();
            const count = data.unreadCount || 0;
            
            // Update cache
            unreadCache.set(channelId, { count, timestamp: Date.now() });
            counts.set(channelId, count);
          } else {
            counts.set(channelId, 0);
          }
        } catch (error: any) {
          if (error.name === 'AbortError') return;
          console.warn(`Failed to fetch unread for ${channelId}:`, error);
          counts.set(channelId, 0);
        }
      });

      await Promise.all(promises);
      setUnreadCounts(new Map(counts));
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching unread counts:', error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [stableChannelIds, enabled]);

  // Initial fetch and setup subscription
  useEffect(() => {
    if (!enabled || stableChannelIds.length === 0) {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
      setUnreadCounts(new Map());
      return;
    }

    // Fetch initial counts
    fetchUnreadCounts();

    // Subscribe to new messages for real-time unread updates
    const channel = supabase
      .channel('unread-updates', {
        config: {
          broadcast: { self: false },
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMessage = payload.new as { channel_id?: string; user_id?: string };
          if (newMessage?.channel_id && stableChannelIds.includes(newMessage.channel_id)) {
            // Increment unread count for this channel (if not the current user's message)
            supabase.auth.getUser().then(({ data: { user } }) => {
              if (user && newMessage.user_id !== user.id) {
                // Invalidate cache and refetch
                unreadCache.delete(newMessage.channel_id!);
                setUnreadCounts(prev => {
                  const newCounts = new Map(prev);
                  const current = newCounts.get(newMessage.channel_id!) || 0;
                  newCounts.set(newMessage.channel_id!, current + 1);
                  return newCounts;
                });
              }
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'unread_messages',
        },
        (payload) => {
          // Handle direct unread count updates (e.g., when marking as read)
          const record = payload.new as { channel_id?: string; unread_count?: number };
          if (record?.channel_id && stableChannelIds.includes(record.channel_id)) {
            const count = record.unread_count || 0;
            unreadCache.set(record.channel_id, { count, timestamp: Date.now() });
            setUnreadCounts(prev => {
              const newCounts = new Map(prev);
              newCounts.set(record.channel_id!, count);
              return newCounts;
            });
          }
        }
      )
      .subscribe();

    subscriptionRef.current = channel;

    return () => {
      if (fetchControllerRef.current) {
        fetchControllerRef.current.abort();
      }
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [stableChannelIds, enabled, fetchUnreadCounts]);

  // Mark channel as read (reset unread count)
  const markAsRead = useCallback(async (channelId: string) => {
    // Optimistically update
    unreadCache.set(channelId, { count: 0, timestamp: Date.now() });
    setUnreadCounts(prev => {
      const newCounts = new Map(prev);
      newCounts.set(channelId, 0);
      return newCounts;
    });

    // Then persist to server
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch(`/api/chats/${channelId}/unread`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
    } catch (error) {
      console.warn('Failed to mark channel as read:', error);
    }
  }, []);

  // Get unread count for a specific channel
  const getUnreadCount = useCallback((channelId: string): number => {
    return unreadCounts.get(channelId) || 0;
  }, [unreadCounts]);

  // Check if any channel has unread messages
  const hasUnread = useMemo(() => {
    for (const count of unreadCounts.values()) {
      if (count > 0) return true;
    }
    return false;
  }, [unreadCounts]);

  // Get total unread count
  const totalUnread = useMemo(() => {
    let total = 0;
    for (const count of unreadCounts.values()) {
      total += count;
    }
    return total;
  }, [unreadCounts]);

  return {
    unreadCounts,
    isLoading,
    hasUnread,
    totalUnread,
    getUnreadCount,
    markAsRead,
    refetch: () => fetchUnreadCounts(true),
  };
}
