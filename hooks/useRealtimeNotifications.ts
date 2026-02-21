import { useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Notification } from '@/types/notification';

interface UseRealtimeNotificationsOptions {
  userId: string | null;
  onNewNotification?: (notification: Notification) => void;
  onNotificationRead?: (notification: Notification) => void;
}

/**
 * Hook to subscribe to real-time updates for notifications
 * Notifies when a new notification is received or when a notification is marked as read
 */
export function useRealtimeNotifications({
  userId,
  onNewNotification,
  onNotificationRead,
}: UseRealtimeNotificationsOptions) {
  useEffect(() => {
    if (!userId) return;

    console.log('[useRealtimeNotifications] Setting up subscription for user:', userId);

    // Subscribe to changes in notifications table for this user
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          console.log('[useRealtimeNotifications] New notification received:', payload);

          if (!payload.new || typeof payload.new !== 'object' || !('id' in payload.new)) {
            console.error('[useRealtimeNotifications] Invalid payload: missing new.id');
            return;
          }

          const notification = payload.new as Notification;

          if (onNewNotification) {
            onNewNotification(notification);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          console.log('[useRealtimeNotifications] Notification updated:', payload);

          if (!payload.new || typeof payload.new !== 'object' || !('id' in payload.new)) {
            console.error('[useRealtimeNotifications] Invalid payload: missing new.id');
            return;
          }

          const notification = payload.new as Notification;
          const oldNotification = payload.old as Partial<Notification>;

          // Check if notification was marked as read
          if (!oldNotification.read && notification.read && onNotificationRead) {
            onNotificationRead(notification);
          }
        }
      )
      .subscribe((status) => {
        console.log('[useRealtimeNotifications] Subscription status:', status);
      });

    return () => {
      console.log('[useRealtimeNotifications] Removing channel for user:', userId);
      supabase.removeChannel(channel);
    };
  }, [userId, onNewNotification, onNotificationRead]);
}

/**
 * Hook to handle notification toast/banner display
 * Can be used in combination with useRealtimeNotifications
 */
export function useNotificationToast() {
  const showToast = useCallback((notification: Notification, language: 'en' | 'ge' = 'ge') => {
    // Get the localized title and message
    const title = typeof notification.title === 'object'
      ? notification.title[language] || notification.title.en
      : notification.title;
    const message = typeof notification.message === 'object'
      ? notification.message[language] || notification.message.en
      : notification.message;

    // You can integrate this with a toast library like react-toastify or sonner
    // For now, we'll use a simple console log
    console.log('[NotificationToast]', { title, message, type: notification.type });

    // If you have a toast library, you can use it here:
    // toast.success(title, { description: message });

    // Or dispatch a custom event for a global notification handler
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notification:new', {
        detail: { notification, title, message },
      }));
    }
  }, []);

  return { showToast };
}
