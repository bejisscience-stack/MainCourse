import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { getCachedUsername, prefetchProfiles } from "./useRealtimeMessages";

interface TypingUser {
  userId: string;
  username: string;
  expiresAt: number;
}

interface UseDMTypingOptions {
  dmChannelId: string | null;
  currentUserId: string;
  enabled?: boolean;
}

const TYPING_TTL = 5000;

export function useDMTyping({
  dmChannelId,
  currentUserId,
  enabled = true,
}: UseDMTypingOptions) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const subscriptionRef = useRef<any>(null);
  const cleanupIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up expired typing indicators
  useEffect(() => {
    if (!enabled || !dmChannelId) return;

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
  }, [dmChannelId, enabled]);

  // Clear typing users when channel changes
  useEffect(() => {
    setTypingUsers([]);
  }, [dmChannelId]);

  useEffect(() => {
    if (!enabled || !dmChannelId) {
      setTypingUsers([]);
      return;
    }

    const channel = supabase
      .channel(`dm-typing:${dmChannelId}`, {
        config: { broadcast: { self: false } },
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dm_typing_indicators",
          filter: `dm_channel_id=eq.${dmChannelId}`,
        },
        async (payload) => {
          const newRecord = payload.new as {
            user_id?: string;
            expires_at?: string;
          } | null;
          const oldRecord = payload.old as { user_id?: string } | null;
          const userId = newRecord?.user_id || oldRecord?.user_id;

          if (!userId || userId === currentUserId) return;

          if (
            payload.eventType === "INSERT" ||
            payload.eventType === "UPDATE"
          ) {
            let username = getCachedUsername(userId);
            if (username === "User") {
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
          } else if (payload.eventType === "DELETE") {
            setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
          }
        },
      )
      .subscribe();

    subscriptionRef.current = channel;

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [dmChannelId, currentUserId, enabled]);

  const stableTypingUsers = useMemo(() => typingUsers, [typingUsers]);

  return { typingUsers: stableTypingUsers };
}
