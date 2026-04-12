import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { edgeFunctionUrl } from "@/lib/api-client";
import type { DMChannel } from "@/types/dm";

interface UseDMChannelsOptions {
  enabled?: boolean;
}

export function useDMChannels({ enabled = true }: UseDMChannelsOptions = {}) {
  const [channels, setChannels] = useState<DMChannel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChannels = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    setError(null);
    try {
      let {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        const {
          data: { session: refreshed },
        } = await supabase.auth.refreshSession();
        session = refreshed;
      }
      if (!session?.access_token) throw new Error("Not authenticated");

      const url = edgeFunctionUrl("dm-channels");
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          ...(anonKey && { apikey: anonKey }),
        },
      });
      if (!response.ok) throw new Error("Failed to fetch DM channels");
      const data = await response.json();
      setChannels(data.channels || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Realtime: refresh on new DM messages
  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel("dm-channels-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dm_messages",
        },
        () => {
          fetchChannels();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, fetchChannels]);

  const openOrCreateChannel = useCallback(
    async (userId: string): Promise<DMChannel | null> => {
      try {
        let {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Not authenticated");

        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const response = await fetch(edgeFunctionUrl("dm-channels"), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            ...(anonKey && { apikey: anonKey }),
          },
          body: JSON.stringify({ userId }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Cannot message this user");
        }

        const data = await response.json();
        const newChannel: DMChannel = {
          id: data.channel.id,
          otherUser: data.channel.otherUser,
          lastMessage: null,
          unreadCount: 0,
          createdAt: new Date().toISOString(),
        };

        // Add to list if not already there
        setChannels((prev) => {
          if (prev.some((c) => c.id === newChannel.id)) return prev;
          return [newChannel, ...prev];
        });

        return newChannel;
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [],
  );

  const getUnreadCount = useCallback(
    (channelId: string) => {
      return channels.find((c) => c.id === channelId)?.unreadCount || 0;
    },
    [channels],
  );

  const totalUnread = channels.reduce((sum, c) => sum + c.unreadCount, 0);

  return {
    channels,
    isLoading,
    error,
    refetch: fetchChannels,
    openOrCreateChannel,
    getUnreadCount,
    totalUnread,
  };
}
