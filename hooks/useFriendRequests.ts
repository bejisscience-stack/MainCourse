import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { edgeFunctionUrl } from "@/lib/api-client";
import type { FriendRequest } from "@/types/dm";

interface UseFriendRequestsOptions {
  enabled?: boolean;
}

export function useFriendRequests({
  enabled = true,
}: UseFriendRequestsOptions = {}) {
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
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

      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const headers = {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        ...(anonKey && { apikey: anonKey }),
      };

      // Fetch incoming and outgoing in parallel
      const [inRes, outRes] = await Promise.all([
        fetch(`${edgeFunctionUrl("friend-requests")}?type=incoming`, {
          headers,
        }),
        fetch(`${edgeFunctionUrl("friend-requests")}?type=outgoing`, {
          headers,
        }),
      ]);

      if (inRes.ok) {
        const data = await inRes.json();
        setIncoming(data.requests || []);
      }
      if (outRes.ok) {
        const data = await outRes.json();
        setOutgoing(data.requests || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Listen for realtime friend request changes (filtered to current user)
  useEffect(() => {
    if (!enabled) return;

    let channel: any = null;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      const userId = session.user.id;

      channel = supabase
        .channel("friend-requests-realtime")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "friend_requests",
            filter: `sender_id=eq.${userId}`,
          },
          () => {
            fetchRequests();
          },
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "friend_requests",
            filter: `receiver_id=eq.${userId}`,
          },
          () => {
            fetchRequests();
          },
        )
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [enabled, fetchRequests]);

  const sendRequest = useCallback(
    async (receiverId: string) => {
      try {
        let {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Not authenticated");

        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const response = await fetch(edgeFunctionUrl("friend-requests"), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            ...(anonKey && { apikey: anonKey }),
          },
          body: JSON.stringify({ receiverId }),
        });

        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Failed to send request");

        await fetchRequests();
        return data;
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [fetchRequests],
  );

  const acceptRequest = useCallback(
    async (requestId: string) => {
      try {
        let {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Not authenticated");

        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const response = await fetch(edgeFunctionUrl("friend-requests"), {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            ...(anonKey && { apikey: anonKey }),
          },
          body: JSON.stringify({ requestId, action: "accept" }),
        });

        if (!response.ok) throw new Error("Failed to accept request");
        await fetchRequests();
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [fetchRequests],
  );

  const rejectRequest = useCallback(
    async (requestId: string) => {
      try {
        let {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Not authenticated");

        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const response = await fetch(edgeFunctionUrl("friend-requests"), {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            ...(anonKey && { apikey: anonKey }),
          },
          body: JSON.stringify({ requestId, action: "reject" }),
        });

        if (!response.ok) throw new Error("Failed to reject request");
        await fetchRequests();
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [fetchRequests],
  );

  return {
    incoming,
    outgoing,
    pendingCount: incoming.length,
    isLoading,
    error,
    refetch: fetchRequests,
    sendRequest,
    acceptRequest,
    rejectRequest,
  };
}
