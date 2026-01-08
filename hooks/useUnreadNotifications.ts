import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import type { UnreadCountResponse } from '@/types/notification';

async function fetchUnreadCount(): Promise<UnreadCountResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    // Return 0 for non-authenticated users
    return { count: 0 };
  }

  const response = await fetch('/api/notifications/unread-count', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Cache-Control': 'no-cache',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    // Return 0 on error instead of throwing to avoid breaking the UI
    console.error('Failed to fetch unread count');
    return { count: 0 };
  }

  return response.json();
}

export function useUnreadNotifications() {
  const { data, error, isLoading, mutate } = useSWR<UnreadCountResponse>(
    'unread-notifications-count',
    fetchUnreadCount,
    {
      revalidateOnFocus: true,
      dedupingInterval: 1000,
      refreshInterval: 30000, // Refresh every 30 seconds
      fallbackData: { count: 0 },
      // Don't throw errors for this hook - UI should gracefully degrade
      onError: (err) => {
        console.error('Error fetching unread count:', err);
      },
    }
  );

  const decrementCount = async () => {
    // Optimistically decrement the count
    await mutate(
      (currentData) => {
        if (!currentData) return { count: 0 };
        return { count: Math.max(0, currentData.count - 1) };
      },
      { revalidate: false }
    );
  };

  const resetCount = async () => {
    // Optimistically set count to 0
    await mutate({ count: 0 }, { revalidate: false });
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
