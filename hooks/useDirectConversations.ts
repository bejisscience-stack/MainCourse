import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { edgeFunctionUrl } from "@/lib/api-client";
import type { DirectConversation } from "@/types/direct-message";

async function authFetch(
  url: string,
  init?: { method?: string; body?: unknown },
): Promise<Response> {
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
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.access_token}`,
  };
  if (init?.body !== undefined) headers["Content-Type"] = "application/json";
  if (anonKey) headers.apikey = anonKey;
  return fetch(url, {
    method: init?.method || "GET",
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

export function useDirectConversations(currentUserId: string | null) {
  const [conversations, setConversations] = useState<DirectConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const enabledRef = useRef(true);

  const fetchList = useCallback(async () => {
    if (!enabledRef.current) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await authFetch(edgeFunctionUrl("dm-conversations"));
      if (!res.ok) throw new Error("Failed to load conversations");
      const json = await res.json();
      setConversations(json.conversations || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load conversations");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    enabledRef.current = true;
    if (!currentUserId) {
      setConversations([]);
      setIsLoading(false);
      return;
    }
    fetchList();

    const channel = supabase
      .channel("dm-conversations-updates")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "dm_messages" },
        () => {
          // Lightweight invalidation — backend filtering happens via RLS in fetchList.
          fetchList();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dm_unread_messages",
          filter: `user_id=eq.${currentUserId}`,
        },
        (payload) => {
          const r = payload.new as {
            conversation_id?: string;
            unread_count?: number;
          } | null;
          if (!r?.conversation_id) return;
          const count = r.unread_count || 0;
          setConversations((prev) =>
            prev.map((c) =>
              c.id === r.conversation_id ? { ...c, unreadCount: count } : c,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      enabledRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [currentUserId, fetchList]);

  const openConversation = useCallback(
    async (friendId: string): Promise<DirectConversation> => {
      const res = await authFetch(edgeFunctionUrl("dm-conversations"), {
        method: "POST",
        body: { friendId },
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to open conversation");
      }
      const json = await res.json();
      const conv: DirectConversation = json.conversation;
      setConversations((prev) => {
        if (prev.some((c) => c.id === conv.id)) return prev;
        return [conv, ...prev];
      });
      return conv;
    },
    [],
  );

  const markRead = useCallback(async (conversationId: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)),
    );
    try {
      await authFetch(edgeFunctionUrl("dm-unread"), {
        method: "POST",
        body: { conversationId },
      });
    } catch {
      // Best-effort — realtime will reconcile.
    }
  }, []);

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
    [conversations],
  );

  return {
    conversations,
    isLoading,
    error,
    refetch: fetchList,
    openConversation,
    markRead,
    totalUnread,
  };
}
