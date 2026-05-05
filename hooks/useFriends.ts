import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { edgeFunctionUrl } from "@/lib/api-client";
import type { Friend, FriendCandidate, FriendRequest } from "@/types/friends";

interface AuthFetchOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

async function authFetch(
  url: string,
  { method = "GET", body, signal }: AuthFetchOptions = {},
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
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (anonKey) headers.apikey = anonKey;

  return fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });
}

export function useFriends() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const enabledRef = useRef(true);

  const fetchAll = useCallback(async () => {
    if (!enabledRef.current) return;
    setIsLoading(true);
    setError(null);
    try {
      const [fRes, iRes, oRes] = await Promise.all([
        authFetch(edgeFunctionUrl("friends") + "?view=friends"),
        authFetch(edgeFunctionUrl("friends") + "?view=incoming"),
        authFetch(edgeFunctionUrl("friends") + "?view=outgoing"),
      ]);
      if (!fRes.ok || !iRes.ok || !oRes.ok)
        throw new Error("Failed to load friends data");

      const [fJson, iJson, oJson] = await Promise.all([
        fRes.json(),
        iRes.json(),
        oRes.json(),
      ]);
      setFriends(fJson.friends || []);
      setIncoming(iJson.requests || []);
      setOutgoing(oJson.requests || []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load friends";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    enabledRef.current = true;
    fetchAll();

    // Realtime: friend_requests changes that involve me trigger a refetch.
    const channel = supabase
      .channel("friends-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_requests" },
        () => {
          fetchAll();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships" },
        () => {
          fetchAll();
        },
      )
      .subscribe();

    return () => {
      enabledRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  const search = useCallback(
    async (q: string, signal?: AbortSignal): Promise<FriendCandidate[]> => {
      if (q.trim().length < 2) return [];
      const res = await authFetch(
        edgeFunctionUrl("friends") +
          "?view=search&q=" +
          encodeURIComponent(q.trim()),
        { signal },
      );
      if (!res.ok) throw new Error("Search failed");
      const json = await res.json();
      return json.candidates || [];
    },
    [],
  );

  const post = useCallback(
    async (action: string, payload: Record<string, unknown> = {}) => {
      const res = await authFetch(edgeFunctionUrl("friends"), {
        method: "POST",
        body: { action, ...payload },
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Action failed: ${action}`);
      }
      return res.json();
    },
    [],
  );

  const sendRequest = useCallback(
    async (userId: string) => {
      const r = await post("send_request", { userId });
      await fetchAll();
      return r;
    },
    [post, fetchAll],
  );

  const cancelRequest = useCallback(
    async (requestId: string) => {
      const r = await post("cancel_request", { requestId });
      await fetchAll();
      return r;
    },
    [post, fetchAll],
  );

  const acceptRequest = useCallback(
    async (requestId: string) => {
      const r = await post("accept_request", { requestId });
      await fetchAll();
      return r;
    },
    [post, fetchAll],
  );

  const declineRequest = useCallback(
    async (requestId: string) => {
      const r = await post("decline_request", { requestId });
      await fetchAll();
      return r;
    },
    [post, fetchAll],
  );

  const removeFriend = useCallback(
    async (userId: string) => {
      const r = await post("remove_friend", { userId });
      await fetchAll();
      return r;
    },
    [post, fetchAll],
  );

  const incomingCount = useMemo(() => incoming.length, [incoming]);

  return {
    friends,
    incoming,
    outgoing,
    incomingCount,
    isLoading,
    error,
    refetch: fetchAll,
    search,
    sendRequest,
    cancelRequest,
    acceptRequest,
    declineRequest,
    removeFriend,
  };
}
