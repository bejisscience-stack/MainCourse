"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { edgeFunctionUrl } from "@/lib/api-client";
import type { PinnedMessage } from "@/types/message";

interface UsePinnedMessagesOptions {
  channelId: string | null;
  enabled?: boolean;
}

async function getAccessToken() {
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

  return session.access_token;
}

async function parsePinsResponse(response: Response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || data.details || "Failed to update pins");
  }

  return Array.isArray(data.pins) ? (data.pins as PinnedMessage[]) : [];
}

export function usePinnedMessages({
  channelId,
  enabled = true,
}: UsePinnedMessagesOptions) {
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingMessageId, setPendingMessageId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchPins = useCallback(
    async (targetChannelId: string, signal?: AbortSignal) => {
      const token = await getAccessToken();
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const url = new URL(edgeFunctionUrl("chat-pins"));
      url.searchParams.set("chatId", targetChannelId);

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(anonKey && { apikey: anonKey }),
        },
        signal,
      });

      if (signal?.aborted) return null;
      return parsePinsResponse(response);
    },
    [],
  );

  const refetch = useCallback(async () => {
    if (!channelId || !enabled) return;

    try {
      const pins = await fetchPins(channelId);
      if (pins) {
        setPinnedMessages(pins);
        setError(null);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load pinned messages");
    }
  }, [channelId, enabled, fetchPins]);

  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (!enabled || !channelId) {
      setPinnedMessages([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const pins = await fetchPins(channelId, abortController.signal);
        if (abortController.signal.aborted || !pins) return;
        setPinnedMessages(pins);
      } catch (err: any) {
        if (!abortController.signal.aborted) {
          setError(err.message || "Failed to load pinned messages");
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    })();

    return () => abortController.abort();
  }, [channelId, enabled, fetchPins]);

  useEffect(() => {
    if (!enabled || !channelId) return;

    const channel = supabase
      .channel(`chat-pins:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_pinned_messages",
          filter: `channel_id=eq.${channelId}`,
        },
        () => {
          refetch();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, enabled, refetch]);

  const updatePin = useCallback(
    async (messageId: string, shouldPin: boolean) => {
      if (!channelId) return;

      setPendingMessageId(messageId);
      setError(null);

      try {
        const token = await getAccessToken();
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const url = new URL(edgeFunctionUrl("chat-pins"));
        let response: Response;
        if (shouldPin) {
          response = await fetch(url.toString(), {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              ...(anonKey && { apikey: anonKey }),
            },
            body: JSON.stringify({ chatId: channelId, messageId }),
          });
        } else {
          url.searchParams.set("chatId", channelId);
          url.searchParams.set("messageId", messageId);
          response = await fetch(url.toString(), {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
              ...(anonKey && { apikey: anonKey }),
            },
          });
        }

        const pins = await parsePinsResponse(response);
        setPinnedMessages(pins);
      } catch (err: any) {
        setError(err.message || "Failed to update pinned message");
        throw err;
      } finally {
        setPendingMessageId(null);
      }
    },
    [channelId],
  );

  const pinMessage = useCallback(
    (messageId: string) => updatePin(messageId, true),
    [updatePin],
  );

  const unpinMessage = useCallback(
    (messageId: string) => updatePin(messageId, false),
    [updatePin],
  );

  const pinnedMessageIds = useMemo(
    () => new Set(pinnedMessages.map((pin) => pin.messageId)),
    [pinnedMessages],
  );

  return {
    pinnedMessages,
    pinnedMessageIds,
    isLoading,
    error,
    pendingMessageId,
    pinMessage,
    unpinMessage,
    refetch,
  };
}
