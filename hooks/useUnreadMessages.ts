import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { edgeFunctionUrl } from "@/lib/api-client";
import { useRealtimeReconnect } from "./useRealtimeReconnect";

interface UseUnreadMessagesOptions {
  channelIds: string[];
  enabled?: boolean;
}

export function useUnreadMessages({
  channelIds,
  enabled = true,
}: UseUnreadMessagesOptions) {
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(
    new Map(),
  );
  const [isLoading, setIsLoading] = useState(false);
  const subscriptionRef = useRef<any>(null);
  const fetchControllerRef = useRef<AbortController | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  // Memoize channel IDs to prevent unnecessary re-subscriptions
  const stableChannelIds = useMemo(() => {
    const sorted = [...channelIds].sort();
    return sorted;
  }, [channelIds.join(",")]);

  // Single batched fetch for all channels (replaces the previous
  // N-parallel-GETs fan-out). Realtime keeps state fresh after the
  // initial load, and useRealtimeReconnect issues a catch-up on drops.
  const fetchUnreadCounts = useCallback(async () => {
    if (!enabled || stableChannelIds.length === 0) {
      setUnreadCounts(new Map());
      return;
    }

    if (fetchControllerRef.current) {
      fetchControllerRef.current.abort();
    }
    fetchControllerRef.current = new AbortController();

    setIsLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setIsLoading(false);
        return;
      }

      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const url = new URL(edgeFunctionUrl("chat-unread"));
      url.searchParams.set("chatIds", stableChannelIds.join(","));

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          ...(anonKey && { apikey: anonKey }),
        },
        signal: fetchControllerRef.current.signal,
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired; let the global auth handler refresh and retry on reconnect.
          return;
        }
        console.warn(`Failed to fetch unread counts: ${response.status}`);
        return;
      }

      const data = await response.json();
      const counts = new Map<string, number>();
      for (const id of stableChannelIds) {
        counts.set(id, data?.counts?.[id] || 0);
      }
      setUnreadCounts(counts);
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error("Error fetching unread counts:", error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [stableChannelIds, enabled]);

  // Initial fetch + realtime subscription. Realtime is the source of truth
  // after this; no polling.
  useEffect(() => {
    if (!enabled || stableChannelIds.length === 0) {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
      setUnreadCounts(new Map());
      return;
    }

    // Capture current user once for INSERT filtering
    supabase.auth.getUser().then(({ data: { user } }) => {
      currentUserIdRef.current = user?.id || null;
    });

    fetchUnreadCounts();

    const channel = supabase
      .channel("unread-updates", {
        config: { broadcast: { self: false } },
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const newMessage = payload.new as {
            channel_id?: string;
            user_id?: string;
          };
          if (
            !newMessage?.channel_id ||
            !stableChannelIds.includes(newMessage.channel_id)
          ) {
            return;
          }
          // Don't increment for messages this user sent
          if (
            currentUserIdRef.current &&
            newMessage.user_id === currentUserIdRef.current
          ) {
            return;
          }
          setUnreadCounts((prev) => {
            const next = new Map(prev);
            const current = next.get(newMessage.channel_id!) || 0;
            next.set(newMessage.channel_id!, current + 1);
            return next;
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "unread_messages",
        },
        (payload) => {
          // Authoritative count from server (e.g. mark-as-read)
          const record = (payload.new || payload.old) as {
            channel_id?: string;
            unread_count?: number;
          };
          if (
            !record?.channel_id ||
            !stableChannelIds.includes(record.channel_id)
          ) {
            return;
          }
          const count =
            payload.eventType === "DELETE" ? 0 : record.unread_count || 0;
          setUnreadCounts((prev) => {
            const next = new Map(prev);
            next.set(record.channel_id!, count);
            return next;
          });
        },
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

  // Catch up after a websocket reconnect (covers tab sleep / network blips)
  useRealtimeReconnect(() => {
    if (enabled && stableChannelIds.length > 0) {
      fetchUnreadCounts();
    }
  });

  // Mark a channel as read with optimistic update + revert on failure
  const markAsRead = useCallback(async (channelId: string) => {
    let previousCount = 0;
    setUnreadCounts((prev) => {
      previousCount = prev.get(channelId) || 0;
      if (previousCount === 0) return prev;
      const next = new Map(prev);
      next.set(channelId, 0);
      return next;
    });

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const response = await fetch(edgeFunctionUrl("chat-unread"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          ...(anonKey && { apikey: anonKey }),
        },
        body: JSON.stringify({ chatId: channelId }),
      });

      if (!response.ok) {
        throw new Error(`Mark as read failed: ${response.status}`);
      }
    } catch (error) {
      console.warn("Failed to mark channel as read, reverting:", error);
      setUnreadCounts((prev) => {
        const next = new Map(prev);
        next.set(channelId, previousCount);
        return next;
      });
    }
  }, []);

  const getUnreadCount = useCallback(
    (channelId: string): number => {
      return unreadCounts.get(channelId) || 0;
    },
    [unreadCounts],
  );

  const hasUnread = useMemo(() => {
    for (const count of unreadCounts.values()) {
      if (count > 0) return true;
    }
    return false;
  }, [unreadCounts]);

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
    refetch: fetchUnreadCounts,
  };
}
