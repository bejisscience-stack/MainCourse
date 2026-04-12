import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { edgeFunctionUrl } from "@/lib/api-client";
import type { Friend } from "@/types/dm";

interface UseFriendsOptions {
  enabled?: boolean;
}

export function useFriends({ enabled = true }: UseFriendsOptions = {}) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFriends = useCallback(async () => {
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

      const url = edgeFunctionUrl("friends");
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          ...(anonKey && { apikey: anonKey }),
        },
      });
      if (!response.ok) throw new Error("Failed to fetch friends");
      const data = await response.json();
      setFriends(data.friends || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  const unfriend = useCallback(async (friendId: string) => {
    try {
      let {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const url = `${edgeFunctionUrl("friends")}?friendId=${friendId}`;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      await fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          ...(anonKey && { apikey: anonKey }),
        },
      });
      setFriends((prev) => prev.filter((f) => f.id !== friendId));
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const isFriend = useCallback(
    (userId: string) => {
      return friends.some((f) => f.id === userId);
    },
    [friends],
  );

  return {
    friends,
    isLoading,
    error,
    refetch: fetchFriends,
    unfriend,
    isFriend,
  };
}
