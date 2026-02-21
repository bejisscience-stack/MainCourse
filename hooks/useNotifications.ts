import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import type { Notification, NotificationsResponse } from '@/types/notification';

interface UseNotificationsOptions {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

async function fetchNotifications(options: UseNotificationsOptions = {}): Promise<NotificationsResponse> {
  const { page = 1, limit = 20, unreadOnly = false } = options;

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error('Not authenticated');
  }

  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...(unreadOnly ? { unread: 'true' } : {}),
  });

  const response = await fetch(`/api/notifications?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Cache-Control': 'no-cache',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error || 'Failed to fetch notifications');
  }

  return response.json();
}

async function markAsRead(notificationId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`/api/notifications/${notificationId}/read`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error || 'Failed to mark notification as read');
  }
}

async function markAllAsRead(): Promise<number> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch('/api/notifications/read-all', {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error || 'Failed to mark all notifications as read');
  }

  const data = await response.json();
  return data.count || 0;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { page = 1, limit = 20, unreadOnly = false } = options;
  const cacheKey = `notifications-${page}-${limit}-${unreadOnly}`;

  const { data, error, isLoading, mutate } = useSWR<NotificationsResponse>(
    cacheKey,
    () => fetchNotifications(options),
    {
      revalidateOnFocus: true,
      dedupingInterval: 1000,
      refreshInterval: 30000, // Refresh every 30 seconds
      fallbackData: {
        notifications: [],
        total: 0,
        page,
        limit,
        hasMore: false,
      },
    }
  );

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markAsRead(notificationId);
      // Optimistically update the cache
      await mutate(
        (currentData) => {
          if (!currentData) return currentData;
          return {
            ...currentData,
            notifications: currentData.notifications.map((n) =>
              n.id === notificationId ? { ...n, read: true, read_at: new Date().toISOString() } : n
            ),
          };
        },
        { revalidate: true }
      );
    } catch (err) {
      console.error('Error marking notification as read:', err);
      throw err;
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const count = await markAllAsRead();
      // Optimistically update the cache
      await mutate(
        (currentData) => {
          if (!currentData) return currentData;
          return {
            ...currentData,
            notifications: currentData.notifications.map((n) => ({
              ...n,
              read: true,
              read_at: n.read_at || new Date().toISOString(),
            })),
          };
        },
        { revalidate: true }
      );
      return count;
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      throw err;
    }
  };

  return {
    notifications: data?.notifications || [],
    total: data?.total || 0,
    hasMore: data?.hasMore || false,
    page: data?.page || page,
    limit: data?.limit || limit,
    isLoading,
    error,
    mutate,
    markAsRead: handleMarkAsRead,
    markAllAsRead: handleMarkAllAsRead,
  };
}
