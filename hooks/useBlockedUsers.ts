import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { edgeFunctionUrl } from "@/lib/api-client";
import type { BlockedUser } from "@/types/dm";

interface UseBlockedUsersOptions {
  enabled?: boolean;
}

export function useBlockedUsers({
  enabled = true,
}: UseBlockedUsersOptions = {}) {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBlockedUsers = useCallback(async () => {
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

      const url = edgeFunctionUrl("blocked-users");
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          ...(anonKey && { apikey: anonKey }),
        },
      });
      if (!response.ok) throw new Error("Failed to fetch blocked users");
      const data = await response.json();
      setBlockedUsers(data.blockedUsers || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetchBlockedUsers();
  }, [fetchBlockedUsers]);

  const blockUser = useCallback(
    async (userId: string) => {
      try {
        let {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Not authenticated");

        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const response = await fetch(edgeFunctionUrl("blocked-users"), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            ...(anonKey && { apikey: anonKey }),
          },
          body: JSON.stringify({ userId }),
        });

        if (!response.ok) throw new Error("Failed to block user");
        await fetchBlockedUsers();
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [fetchBlockedUsers],
  );

  const unblockUser = useCallback(async (userId: string) => {
    try {
      let {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const url = `${edgeFunctionUrl("blocked-users")}?userId=${userId}`;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      await fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          ...(anonKey && { apikey: anonKey }),
        },
      });
      setBlockedUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  const isBlocked = useCallback(
    (userId: string) => {
      return blockedUsers.some((u) => u.id === userId);
    },
    [blockedUsers],
  );

  return {
    blockedUsers,
    isLoading,
    error,
    refetch: fetchBlockedUsers,
    blockUser,
    unblockUser,
    isBlocked,
  };
}
