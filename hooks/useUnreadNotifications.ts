import { useCallback } from "react";
import useSWR from "swr";
import { supabase } from "@/lib/supabase";
import type { UnreadCountResponse } from "@/types/notification";
import { useUser } from "./useUser";
import { useRealtimeNotifications } from "./useRealtimeNotifications";
import { useRealtimeReconnect } from "./useRealtimeReconnect";

async function fetchUnreadCount(): Promise<UnreadCountResponse> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    // Return 0 for non-authenticated users
    return { count: 0 };
  }

  const response = await fetch("/api/notifications/unread-count", {
    headers: {
      Authorization: `Bearer ${token}`,
      "Cache-Control": "no-cache",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    // Return 0 on error instead of throwing to avoid breaking the UI
    console.error("Failed to fetch unread count");
    return { count: 0 };
  }

  return response.json();
}

export function useUnreadNotifications() {
  const { user } = useUser();
  const { data, error, isLoading, mutate } = useSWR<UnreadCountResponse>(
    "unread-notifications-count",
    fetchUnreadCount,
    {
      revalidateOnFocus: false,
      dedupingInterval: 1000,
      fallbackData: { count: 0 },
      // Don't throw errors for this hook - UI should gracefully degrade
      onError: (err) => {
        console.error("Error fetching unread count:", err);
      },
    },
  );

  // Live updates via websocket: bump on new notification,
  // decrement when one is marked read elsewhere.
  const handleNewNotification = useCallback(() => {
    mutate((current) => ({ count: (current?.count || 0) + 1 }), {
      revalidate: false,
    });
  }, [mutate]);

  const handleNotificationRead = useCallback(() => {
    mutate((current) => ({ count: Math.max(0, (current?.count || 0) - 1) }), {
      revalidate: false,
    });
  }, [mutate]);

  useRealtimeNotifications({
    userId: user?.id || null,
    onNewNotification: handleNewNotification,
    onNotificationRead: handleNotificationRead,
  });

  // Catch up on the authoritative count after a websocket reconnect.
  useRealtimeReconnect(() => {
    mutate();
  });

  const decrementCount = async () => {
    // Optimistically decrement the count
    await mutate(
      (currentData) => {
        if (!currentData) return { count: 0 };
        return { count: Math.max(0, currentData.count - 1) };
      },
      { revalidate: false },
    );
  };

  const resetCount = async () => {
    // Set count to 0 immediately for instant UI feedback
    await mutate({ count: 0 }, { revalidate: false });

    // Schedule a delayed server sync to confirm the count is correct
    // This gives the database time to commit the transaction
    setTimeout(() => {
      mutate();
    }, 500);
  };

  const refresh = async () => {
    await mutate();
  };

  return {
    unreadCount: data?.count || 0,
    isLoading,
    error,
    mutate,
    decrementCount,
    resetCount,
    refresh,
  };
}
