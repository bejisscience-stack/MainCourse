import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { DMMessage } from "@/types/dm";
import {
  prefetchProfiles,
  getCachedUsername,
  getCachedAvatarUrl,
} from "./useRealtimeMessages";

interface UseRealtimeDMOptions {
  dmChannelId: string | null;
  enabled?: boolean;
  onNewMessage?: (message: DMMessage) => void;
  onMessageUpdate?: (message: DMMessage) => void;
  onMessageDelete?: (messageId: string) => void;
}

export function useRealtimeDM({
  dmChannelId,
  enabled = true,
  onNewMessage,
  onMessageUpdate,
  onMessageDelete,
}: UseRealtimeDMOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled || !dmChannelId) {
      setIsConnected(false);
      return;
    }

    const channelName = `dm-messages:${dmChannelId}`;

    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    // Listen for broadcast messages (instant delivery)
    channel.on(
      "broadcast",
      { event: "new_dm_message" },
      async (payload: any) => {
        const msg = payload.payload;
        if (!msg || !msg.id) return;

        // Ensure profile is cached
        if (!getCachedUsername(msg.user?.id)) {
          await prefetchProfiles([msg.user?.id]).catch(() => {});
        }

        const message: DMMessage = {
          id: msg.id,
          user: {
            id: msg.user?.id || "",
            username:
              msg.user?.username || getCachedUsername(msg.user?.id) || "User",
            avatarUrl:
              msg.user?.avatarUrl || getCachedAvatarUrl(msg.user?.id) || "",
          },
          content: msg.content || "",
          timestamp: msg.timestamp || Date.now(),
          edited: msg.edited || false,
          replyTo: msg.replyTo,
          replyPreview: msg.replyPreview,
          attachments: msg.attachments,
          reactions: msg.reactions || [],
        };

        onNewMessage?.(message);
      },
    );

    // Also listen for postgres changes as fallback
    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "dm_messages",
        filter: `dm_channel_id=eq.${dmChannelId}`,
      },
      async (payload: any) => {
        const record = payload.new;
        if (!record) return;

        await prefetchProfiles([record.user_id]).catch(() => {});

        const message: DMMessage = {
          id: record.id,
          user: {
            id: record.user_id,
            username: getCachedUsername(record.user_id) || "User",
            avatarUrl: getCachedAvatarUrl(record.user_id) || "",
          },
          content: record.content || "",
          timestamp: new Date(record.created_at).getTime(),
          edited: !!record.edited_at,
          replyTo: record.reply_to_id || undefined,
          reactions: [],
        };

        onNewMessage?.(message);
      },
    );

    channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "dm_messages",
        filter: `dm_channel_id=eq.${dmChannelId}`,
      },
      async (payload: any) => {
        const record = payload.new;
        if (!record) return;

        const message: DMMessage = {
          id: record.id,
          user: {
            id: record.user_id,
            username: getCachedUsername(record.user_id) || "User",
            avatarUrl: getCachedAvatarUrl(record.user_id) || "",
          },
          content: record.content || "",
          timestamp: new Date(record.created_at).getTime(),
          edited: !!record.edited_at,
          replyTo: record.reply_to_id || undefined,
          reactions: [],
        };

        onMessageUpdate?.(message);
      },
    );

    channel.on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "dm_messages",
        filter: `dm_channel_id=eq.${dmChannelId}`,
      },
      (payload: any) => {
        const record = payload.old;
        if (record?.id) {
          onMessageDelete?.(record.id);
        }
      },
    );

    channel.subscribe((status: string) => {
      setIsConnected(status === "SUBSCRIBED");
    });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      setIsConnected(false);
    };
  }, [dmChannelId, enabled, onNewMessage, onMessageUpdate, onMessageDelete]);

  return { isConnected, channelRef };
}
