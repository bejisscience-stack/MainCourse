import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { edgeFunctionUrl } from "@/lib/api-client";
import type { DMMessage } from "@/types/dm";
import type { MessageAttachment } from "@/types/message";
import { useRealtimeDM } from "./useRealtimeDM";
import {
  getCachedUsername,
  getCachedAvatarUrl,
  prefetchProfiles,
} from "./useRealtimeMessages";

interface UseDMMessagesOptions {
  dmChannelId: string | null;
  enabled?: boolean;
}

interface PendingDMMessage extends DMMessage {
  pending: true;
  tempId: string;
}

interface FailedDMMessage extends DMMessage {
  failed: true;
  error?: string;
  tempId?: string;
}

type ChatDMMessage = DMMessage | PendingDMMessage | FailedDMMessage;

function findMatchingPending(
  pendingMap: Map<string, PendingDMMessage>,
  message: DMMessage,
): PendingDMMessage | undefined {
  return Array.from(pendingMap.values()).find((p) => {
    const contentMatches = (p.content || "") === (message.content || "");
    const userMatches = p.user.id === message.user.id;
    const timeClose = Math.abs(p.timestamp - message.timestamp) < 15000;
    return contentMatches && userMatches && timeClose;
  });
}

export function useDMMessages({
  dmChannelId,
  enabled = true,
}: UseDMMessagesOptions) {
  const [messages, setMessages] = useState<ChatDMMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pendingMessagesRef = useRef<Map<string, PendingDMMessage>>(new Map());
  const messageIdsRef = useRef<Set<string>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);
  const channelIdRef = useRef<string | null>(null);

  const fetchMessages = useCallback(
    async (targetChannelId: string, before?: string, signal?: AbortSignal) => {
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

        const url = new URL(edgeFunctionUrl("dm-messages"));
        url.searchParams.set("dmChannelId", targetChannelId);
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
        if (!response.ok) throw new Error("Failed to fetch messages");
        return response.json();
      } catch (err: any) {
        if (err.name === "AbortError") return null;
        throw err;
      }
    },
    [],
  );

  // Main effect - handles channel changes and initial load
  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (!enabled || !dmChannelId) {
      setMessages([]);
      setError(null);
      setIsLoading(false);
      messageIdsRef.current.clear();
      pendingMessagesRef.current.clear();
      channelIdRef.current = null;
      return;
    }

    const isNewChannel = channelIdRef.current !== dmChannelId;
    channelIdRef.current = dmChannelId;

    if (isNewChannel) {
      setMessages([]);
      setError(null);
      setHasMore(true);
      messageIdsRef.current.clear();
      pendingMessagesRef.current.clear();
    }

    setIsLoading(true);
    setError(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    (async () => {
      try {
        const result = await fetchMessages(
          dmChannelId,
          undefined,
          abortController.signal,
        );
        if (abortController.signal.aborted || !result) return;

        const fetchedMessages: DMMessage[] = result.messages || [];
        messageIdsRef.current = new Set(fetchedMessages.map((m) => m.id));
        setMessages(fetchedMessages);
        setHasMore(fetchedMessages.length === 50);
        setIsLoading(false);
        setError(null);

        if (fetchedMessages.length > 0) {
          const userIds = [...new Set(fetchedMessages.map((m) => m.user.id))];
          prefetchProfiles(userIds).catch(() => {});
        }
      } catch (err: any) {
        if (abortController.signal.aborted) return;
        setError(err.message || "Failed to load messages");
        setIsLoading(false);
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [dmChannelId, enabled, fetchMessages]);

  const handleNewMessage = useCallback((message: DMMessage) => {
    setMessages((prev) => {
      const existingIdx = prev.findIndex((m) => m.id === message.id);
      if (existingIdx !== -1) return prev;

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

  const handleMessageUpdate = useCallback((message: DMMessage) => {
    setMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
  }, []);

  const handleMessageDelete = useCallback((messageId: string) => {
    messageIdsRef.current.delete(messageId);
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, []);

  // Realtime subscription for DM
  const { isConnected, channelRef } = useRealtimeDM({
    dmChannelId,
    enabled,
    onNewMessage: handleNewMessage,
    onMessageUpdate: handleMessageUpdate,
    onMessageDelete: handleMessageDelete,
  });

  const broadcastMessage = useCallback(
    (message: DMMessage) => {
      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "new_dm_message",
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
      const pendingMessage: PendingDMMessage = {
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

      pendingMessagesRef.current.set(tempId, pendingMessage);
      setMessages((prev) => [...prev, pendingMessage]);
      return tempId;
    },
    [],
  );

  const markMessageFailed = useCallback((tempId: string, errorMsg?: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if ("tempId" in m && m.tempId === tempId) {
          const failed: FailedDMMessage = {
            ...m,
            failed: true,
            error: errorMsg,
          };
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

  const replacePendingMessage = useCallback(
    (tempId: string, realMessage: DMMessage) => {
      pendingMessagesRef.current.delete(tempId);
      messageIdsRef.current.add(realMessage.id);
      setMessages((prev) => {
        if (prev.some((m) => m.id === realMessage.id)) {
          return prev.filter((m) => !("tempId" in m && m.tempId === tempId));
        }
        return prev.map((m) =>
          "tempId" in m && m.tempId === tempId ? realMessage : m,
        );
      });
    },
    [],
  );

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading || messages.length === 0 || !dmChannelId) return;
    const oldestMessage = messages.find((m) => !("pending" in m));
    if (!oldestMessage) return;

    setIsLoading(true);
    try {
      const before = new Date(oldestMessage.timestamp).toISOString();
      const result = await fetchMessages(dmChannelId, before);
      if (!result) return;
      const olderMessages: DMMessage[] = result.messages || [];
      if (olderMessages.length > 0) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newMessages = olderMessages.filter(
            (m) => !existingIds.has(m.id),
          );
          newMessages.forEach((m) => messageIdsRef.current.add(m.id));
          return [...newMessages, ...prev];
        });
      }
      setHasMore(olderMessages.length === 50);
    } catch (err: any) {
      console.error("Error loading more DM messages:", err);
    } finally {
      setIsLoading(false);
    }
  }, [hasMore, isLoading, messages, dmChannelId, fetchMessages]);

  const updateMessage = useCallback(
    (messageId: string, updates: Partial<DMMessage>) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, ...updates } : msg,
        ),
      );
    },
    [],
  );

  return {
    messages,
    isLoading,
    error,
    hasMore,
    isConnected,
    messagesEndRef,
    addPendingMessage,
    markMessageFailed,
    removePendingMessage,
    replacePendingMessage,
    loadMore,
    updateMessage,
    broadcastMessage,
  };
}
