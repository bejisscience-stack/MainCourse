'use client';

import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useUser } from '@/hooks/useUser';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import { useI18n } from '@/contexts/I18nContext';
import NotificationDropdown from './NotificationDropdown';
import type { Notification } from '@/types/notification';

function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const bellButtonRef = useRef<HTMLButtonElement>(null);
  const { user } = useUser();
  const { unreadCount, refresh, mutate } = useUnreadNotifications();
  const { t, language } = useI18n();

  // Handle new notification received in real-time
  const handleNewNotification = useCallback((notification: Notification) => {
    console.log('[NotificationBell] New notification received:', notification);
    // Increment unread count
    mutate((current) => ({ count: (current?.count || 0) + 1 }), { revalidate: false });

    // Show browser notification if supported and permitted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const title = typeof notification.title === 'object'
        ? notification.title[language] || notification.title.en
        : notification.title;
      const message = typeof notification.message === 'object'
        ? notification.message[language] || notification.message.en
        : notification.message;

      new Notification(title, {
        body: message,
        icon: '/favicon.ico',
      });
    }
  }, [language, mutate]);

  // Set up real-time subscription
  useRealtimeNotifications({
    userId: user?.id || null,
    onNewNotification: handleNewNotification,
  });

  // Calculate dropdown position when opened
  useEffect(() => {
    if (isOpen && bellButtonRef.current) {
      const rect = bellButtonRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const dropdownWidth = 384; // w-96 = 384px
      const padding = 16;

      let right = viewportWidth - rect.right;
      if (right < padding) {
        right = padding;
      }

      setDropdownPosition({
        top: rect.bottom + 8,
        right: Math.max(right, padding),
      });
    }
  }, [isOpen]);

  // Request notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      // Don't auto-request, let user opt-in through settings or on first notification
    }
  }, []);

  if (!user) {
    return null;
  }

  return (
    <div className="relative">
      <button
        ref={bellButtonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-charcoal-100/50 dark:hover:bg-navy-800/50 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2"
        aria-label={t('notifications.title')}
      >
        {/* Bell Icon */}
        <svg
          className="w-5 h-5 text-charcoal-600 dark:text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[9998] bg-black/20"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <NotificationDropdown
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            position={dropdownPosition}
            onUnreadCountChange={refresh}
          />
        </>
      )}
    </div>
  );
}

export default memo(NotificationBell);
