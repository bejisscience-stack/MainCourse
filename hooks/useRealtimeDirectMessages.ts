import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Message, ReplyPreview } from "@/types/message";
import type { DmTypingUser } from "@/types/direct-message";
import { getCachedAvatarUrl, getCachedUsername } from "./useRealtimeMessages";

interface UseRealtimeDirectMessagesOptions {
  conversationId: string | null;
  enabled?: boolean;
  onNewMessage?: (message: Message) => void;
  onMessageUpdate?: (message: Message) => void;
  onMessageDelete?: (messageId: string) => void;
}

const MAX_RECONNECT_ATTEMPTS = 10;
const MAX_BACKOFF_MS = 30000;
const TYPING_TTL_MS = 3000;

async function fetchReplyPreview(
  replyToId: string,
): Promise<ReplyPreview | undefined> {
  try {
    const { data: replyMessage, error } = await supabase
      .from("dm_messages")
      .select("id, content, user_id")
      .eq("id", replyToId)
      .single();
    if (error || !replyMessage) return undefined;

    const username = getCachedUsername(replyMessage.user_id);
    const content = replyMessage.content || "";
    return {
      id: replyMessage.id,
      username,
      content: content.substring(0, 50) + (content.length > 50 ? "..." : ""),
    };
  } catch {
    return undefined;
  }
}

async function fetchAttachments(messageId: string) {
  try {
    const { data: attachments } = await supabase
      .from("dm_message_attachments")
      .select(
        "id, file_url, file_path, file_name, file_type, file_size, mime_type",
      )
      .eq("message_id", messageId);
    if (attachments && attachments.length > 0) {
      return attachments.map((a) => ({
        id: a.id,
        fileUrl: a.file_url,
        filePath: a.file_path || undefined,
        fileName: a.file_name,
        fileType: a.file_type as "image" | "video" | "gif",
        fileSize: a.file_size,
        mimeType: a.mime_type,
      }));
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

export function useRealtimeDirectMessages({
  conversationId,
  enabled = true,
  onNewMessage,
  onMessageUpdate,
  onMessageDelete,
}: UseRealtimeDirectMessagesOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<DmTypingUser[]>([]);
  // deno-lint-ignore no-explicit-any
  const subscriptionRef = useRef<any>(null);
  const callbacksRef = useRef({
    onNewMessage,
    onMessageUpdate,
    onMessageDelete,
  });
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const typingMapRef = useRef<Map<string, DmTypingUser>>(new Map());
  const typingPruneIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  useEffect(() => {
    callbacksRef.current = { onNewMessage, onMessageUpdate, onMessageDelete };
  }, [onNewMessage, onMessageUpdate, onMessageDelete]);

  useEffect(() => {
    if (!enabled || !conversationId) {
      setIsConnected(false);
      typingMapRef.current.clear();
      setTypingUsers([]);
      return;
    }

    let cancelled = false;

    const pruneTyping = () => {
      const now = Date.now();
      let changed = false;
      for (const [k, v] of typingMapRef.current.entries()) {
        if (v.expiresAt <= now) {
          typingMapRef.current.delete(k);
          changed = true;
        }
      }
      if (changed) setTypingUsers([...typingMapRef.current.values()]);
    };
    typingPruneIntervalRef.current = setInterval(pruneTyping, 1000);

    function setupSubscription() {
      if (cancelled) return;
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }

      const channel = supabase
        .channel(`messages:dm:${conversationId}`, {
          config: {
            broadcast: { self: false },
            presence: { key: "" },
          },
        })
        .on(
          "broadcast",
          { event: "new_message" },
          (payload: { payload: Message }) => {
            const message = payload.payload;
            if (message?.id) callbacksRef.current.onNewMessage?.(message);
          },
        )
        .on(
          "broadcast",
          { event: "typing" },
          (payload: {
            payload: { userId: string; username: string; expiresAt?: number };
          }) => {
            const { userId, username, expiresAt } = payload.payload || {};
            if (!userId) return;
            typingMapRef.current.set(userId, {
              id: userId,
              username: username || getCachedUsername(userId),
              expiresAt: expiresAt || Date.now() + TYPING_TTL_MS,
            });
            setTypingUsers([...typingMapRef.current.values()]);
          },
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "dm_messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          async (payload) => {
            const m = payload.new as {
              id: string;
              content: string | null;
              reply_to_id?: string | null;
              edited_at?: string | null;
              created_at: string;
              user_id: string;
            };

            const cachedUsername = getCachedUsername(m.user_id);
            const message: Message = {
              id: m.id,
              content: m.content || "",
              replyTo: m.reply_to_id || undefined,
              edited: !!m.edited_at,
              timestamp: new Date(m.created_at).getTime(),
              user: {
                id: m.user_id,
                username: cachedUsername,
                avatarUrl: getCachedAvatarUrl(m.user_id),
              },
            };
            callbacksRef.current.onNewMessage?.(message);

            const [replyPreview, attachments] = await Promise.all([
              m.reply_to_id
                ? fetchReplyPreview(m.reply_to_id)
                : Promise.resolve(undefined),
              fetchAttachments(m.id),
            ]);
            if (replyPreview || attachments) {
              callbacksRef.current.onNewMessage?.({
                ...message,
                replyPreview,
                attachments,
              });
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "dm_messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          async (payload) => {
            const m = payload.new as {
              id: string;
              content: string | null;
              reply_to_id?: string | null;
              edited_at?: string | null;
              created_at: string;
              user_id: string;
            };
            const [replyPreview, attachments] = await Promise.all([
              m.reply_to_id
                ? fetchReplyPreview(m.reply_to_id)
                : Promise.resolve(undefined),
              fetchAttachments(m.id),
            ]);
            const message: Message = {
              id: m.id,
              content: m.content || "",
              replyTo: m.reply_to_id || undefined,
              replyPreview,
              attachments,
              edited: !!m.edited_at,
              timestamp: new Date(m.created_at).getTime(),
              user: {
                id: m.user_id,
                username: getCachedUsername(m.user_id),
                avatarUrl: getCachedAvatarUrl(m.user_id),
              },
            };
            callbacksRef.current.onMessageUpdate?.(message);
          },
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "dm_messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const old = payload.old as { id?: string };
            if (old?.id) callbacksRef.current.onMessageDelete?.(old.id);
          },
        )
        .subscribe((status) => {
          if (cancelled) return;
          setIsConnected(status === "SUBSCRIBED");
          if (status === "SUBSCRIBED") {
            reconnectAttemptsRef.current = 0;
          } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
            scheduleReconnect();
          }
        });

      subscriptionRef.current = channel;
    }

    function scheduleReconnect() {
      if (cancelled) return;
      if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) return;
      const delay = Math.min(
        1000 * Math.pow(2, reconnectAttemptsRef.current),
        MAX_BACKOFF_MS,
      );
      reconnectAttemptsRef.current += 1;
      reconnectTimerRef.current = setTimeout(() => {
        if (!cancelled) setupSubscription();
      }, delay);
    }

    setupSubscription();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (typingPruneIntervalRef.current) {
        clearInterval(typingPruneIntervalRef.current);
        typingPruneIntervalRef.current = null;
      }
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
      typingMapRef.current.clear();
      setTypingUsers([]);
      setIsConnected(false);
    };
  }, [conversationId, enabled]);

  const broadcastTyping = useCallback((userId: string, username: string) => {
    const channel = subscriptionRef.current;
    if (!channel || !userId) return;
    channel.send({
      type: "broadcast",
      event: "typing",
      payload: {
        userId,
        username,
        expiresAt: Date.now() + TYPING_TTL_MS,
      },
    });
  }, []);

  return {
    isConnected,
    channelRef: subscriptionRef,
    typingUsers,
    broadcastTyping,
  };
}
