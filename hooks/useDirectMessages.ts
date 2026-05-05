import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { edgeFunctionUrl } from "@/lib/api-client";
import type { Message, MessageAttachment } from "@/types/message";
import {
  getCachedAvatarUrl,
  getCachedUsername,
  prefetchProfiles,
} from "./useRealtimeMessages";
import { useRealtimeDirectMessages } from "./useRealtimeDirectMessages";

interface UseDirectMessagesOptions {
  conversationId: string | null;
  enabled?: boolean;
}

interface PendingMessage extends Message {
  pending: true;
  tempId: string;
}

interface FailedMessage extends Message {
  failed: true;
  error?: string;
  tempId?: string;
}

type DmChatMessage = Message | PendingMessage | FailedMessage;

function findMatchingPending(
  pendingMap: Map<string, PendingMessage>,
  message: Message,
): PendingMessage | undefined {
  return Array.from(pendingMap.values()).find((p) => {
    const contentMatches = (p.content || "") === (message.content || "");
    const userMatches = p.user.id === message.user.id;
    const timeClose = Math.abs(p.timestamp - message.timestamp) < 15000;
    return contentMatches && userMatches && timeClose;
  });
}

export function useDirectMessages({
  conversationId,
  enabled = true,
}: UseDirectMessagesOptions) {
  const [messages, setMessages] = useState<DmChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pendingMessagesRef = useRef<Map<string, PendingMessage>>(new Map());
  const messageIdsRef = useRef<Set<string>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  const fetchMessages = useCallback(
    async (
      targetConversationId: string,
      before?: string,
      signal?: AbortSignal,
    ) => {
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
        if (!session?.access_token) {
          throw new Error("Not authenticated. Please log in again.");
        }

        const url = new URL(edgeFunctionUrl("dm-messages"));
        url.searchParams.set("conversationId", targetConversationId);
        if (before) url.searchParams.set("before", before);
        url.searchParams.set("limit", "50");

        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            ...(anonKey && { apikey: anonKey }),
          },
          signal,
        });
        if (signal?.aborted) return null;

        if (!response.ok) {
          if (response.status === 401) {
            const {
              data: { session: newSession },
            } = await supabase.auth.refreshSession();
            if (newSession?.access_token) {
              const retry = await fetch(url.toString(), {
                headers: {
                  Authorization: `Bearer ${newSession.access_token}`,
                  "Content-Type": "application/json",
                  ...(anonKey && { apikey: anonKey }),
                },
                signal,
              });
              if (retry.ok) return retry.json();
            }
            throw new Error("Session expired. Please refresh the page.");
          }
          const errJson = await response.json().catch(() => ({}));
          throw new Error(errJson.error || "Failed to fetch messages");
        }
        return response.json();
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return null;
        throw err;
      }
    },
    [],
  );

  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (!enabled || !conversationId) {
      setMessages([]);
      setError(null);
      setIsLoading(false);
      messageIdsRef.current.clear();
      pendingMessagesRef.current.clear();
      conversationIdRef.current = null;
      return;
    }

    const isNew = conversationIdRef.current !== conversationId;
    conversationIdRef.current = conversationId;
    if (isNew) {
      setMessages([]);
      setError(null);
      setHasMore(true);
      messageIdsRef.current.clear();
      pendingMessagesRef.current.clear();
    }

    setIsLoading(true);
    setError(null);
    const ac = new AbortController();
    abortControllerRef.current = ac;

    (async () => {
      try {
        const result = await fetchMessages(
          conversationId,
          undefined,
          ac.signal,
        );
        if (ac.signal.aborted || !result) return;
        const fetched: Message[] = result.messages || [];
        messageIdsRef.current = new Set(fetched.map((m) => m.id));
        setMessages(fetched);
        setHasMore(fetched.length === 50);
        setIsLoading(false);
        if (fetched.length > 0) {
          const userIds = [...new Set(fetched.map((m) => m.user.id))];
          prefetchProfiles(userIds).catch(() => {});
        }
      } catch (err: unknown) {
        if (ac.signal.aborted) return;
        const msg =
          err instanceof Error ? err.message : "Failed to load messages";
        setError(msg);
        setIsLoading(false);
      }
    })();

    return () => {
      ac.abort();
    };
  }, [conversationId, enabled, fetchMessages]);

  const handleNewMessage = useCallback((message: Message) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === message.id);
      if (idx !== -1) {
        const existing = prev[idx];
        const shouldUpdate =
          ((!existing.user.username || existing.user.username === "User") &&
            message.user.username &&
            message.user.username !== "User") ||
          message.replyPreview ||
          message.attachments;
        if (shouldUpdate) {
          return prev.map((m, i) =>
            i === idx ? { ...existing, ...message } : m,
          );
        }
        return prev;
      }

      const pending = findMatchingPending(pendingMessagesRef.current, message);
      if (pending) {
        pendingMessagesRef.current.delete(pending.tempId);
        messageIdsRef.current.add(message.id);
        return prev.map((m) =>
          "tempId" in m && m.tempId === pending.tempId ? message : m,
        );
      }

      if (!messageIdsRef.current.has(message.id)) {
        messageIdsRef.current.add(message.id);
        return [...prev, message];
      }
      return prev;
    });
  }, []);

  const handleMessageUpdate = useCallback((message: Message) => {
    setMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
  }, []);

  const handleMessageDelete = useCallback((messageId: string) => {
    messageIdsRef.current.delete(messageId);
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, []);

  const { isConnected, channelRef, typingUsers, broadcastTyping } =
    useRealtimeDirectMessages({
      conversationId,
      enabled,
      onNewMessage: handleNewMessage,
      onMessageUpdate: handleMessageUpdate,
      onMessageDelete: handleMessageDelete,
    });

  const broadcastMessage = useCallback(
    (message: Message) => {
      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "new_message",
          payload: message,
        });
      }
    },
    [channelRef],
  );

  const addPendingMessage = useCallback(
    (
      content: string,
      replyTo?: string,
      userId?: string,
      attachments?: MessageAttachment[],
      replyPreview?: { id: string; username: string; content: string },
    ): string => {
      const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const pending: PendingMessage = {
        id: tempId,
        tempId,
        content,
        replyTo,
        replyPreview,
        attachments,
        timestamp: Date.now(),
        pending: true,
        user: {
          id: userId || "",
          username: getCachedUsername(userId || "") || "You",
          avatarUrl: getCachedAvatarUrl(userId || ""),
        },
      };
      pendingMessagesRef.current.set(tempId, pending);
      setMessages((prev) => [...prev, pending]);
      return tempId;
    },
    [],
  );

  const markMessageFailed = useCallback((tempId: string, errorMsg?: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if ("tempId" in m && m.tempId === tempId) {
          const failed: FailedMessage = {
            ...m,
            failed: true,
            error: errorMsg,
          };
          // deno-lint-ignore no-explicit-any
          delete (failed as any).pending;
          return failed;
        }
        return m;
      }),
    );
  }, []);

  const removePendingMessage = useCallback((tempId: string) => {
    pendingMessagesRef.current.delete(tempId);
    setMessages((prev) =>
      prev.filter((m) => !("tempId" in m && m.tempId === tempId)),
    );
  }, []);

  const replacePendingMessage = useCallback((tempId: string, real: Message) => {
    pendingMessagesRef.current.delete(tempId);
    messageIdsRef.current.add(real.id);
    setMessages((prev) => {
      if (prev.some((m) => m.id === real.id)) {
        return prev.filter((m) => !("tempId" in m && m.tempId === tempId));
      }
      return prev.map((m) => ("tempId" in m && m.tempId === tempId ? real : m));
    });
  }, []);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading || messages.length === 0 || !conversationId)
      return;
    const oldest = messages.find((m) => !("pending" in m));
    if (!oldest || !("timestamp" in oldest)) return;
    setIsLoading(true);
    try {
      const before = new Date(oldest.timestamp).toISOString();
      const result = await fetchMessages(conversationId, before);
      if (!result) return;
      const older: Message[] = result.messages || [];
      if (older.length > 0) {
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => m.id));
          const fresh = older.filter((m) => !ids.has(m.id));
          fresh.forEach((m) => messageIdsRef.current.add(m.id));
          return [...fresh, ...prev];
        });
      }
      setHasMore(older.length === 50);
    } finally {
      setIsLoading(false);
    }
  }, [hasMore, isLoading, messages, conversationId, fetchMessages]);

  return {
    messages,
    isLoading,
    error,
    hasMore,
    isConnected,
    messagesEndRef,
    typingUsers,
    broadcastTyping,
    addPendingMessage,
    markMessageFailed,
    removePendingMessage,
    replacePendingMessage,
    loadMore,
    broadcastMessage,
  };
}
