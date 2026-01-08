'use client';

import { memo, useCallback } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import { useI18n } from '@/contexts/I18nContext';
import { getLocalizedText, notificationColors, type Notification } from '@/types/notification';
import { formatDistanceToNow } from 'date-fns';
import { enUS, ka } from 'date-fns/locale';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  position: { top: number; right: number };
  onUnreadCountChange?: () => void;
}

function NotificationItem({
  notification,
  language,
  onMarkAsRead,
}: {
  notification: Notification;
  language: 'en' | 'ge';
  onMarkAsRead: (id: string) => void;
}) {
  const title = getLocalizedText(notification.title, language);
  const message = getLocalizedText(notification.message, language);
  const colors = notificationColors[notification.type] || notificationColors.system;

  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
    locale: language === 'ge' ? ka : enUS,
  });

  const handleClick = useCallback(() => {
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }
  }, [notification.id, notification.read, onMarkAsRead]);

  return (
    <div
      onClick={handleClick}
      className={`
        relative px-4 py-3 cursor-pointer transition-colors
        ${notification.read
          ? 'bg-transparent hover:bg-charcoal-50/50 dark:hover:bg-navy-700/50'
          : `${colors.bg} hover:opacity-90`
        }
      `}
    >
      {/* Unread indicator */}
      {!notification.read && (
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-500" />
      )}

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 mt-0.5 ${colors.icon}`}>
          {notification.type.includes('approved') ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : notification.type.includes('rejected') ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : notification.type === 'admin_message' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${notification.read ? 'text-charcoal-700 dark:text-gray-300' : colors.text}`}>
            {title}
          </p>
          {message && (
            <p className={`text-sm mt-0.5 line-clamp-2 ${notification.read ? 'text-charcoal-500 dark:text-gray-400' : 'text-charcoal-600 dark:text-gray-300'}`}>
              {message}
            </p>
          )}
          <p className="text-xs text-charcoal-400 dark:text-gray-500 mt-1">
            {timeAgo}
          </p>
        </div>
      </div>
    </div>
  );
}

function NotificationDropdown({ isOpen, onClose, position, onUnreadCountChange }: NotificationDropdownProps) {
  const { notifications, isLoading, markAsRead, markAllAsRead, mutate } = useNotifications({ limit: 10 });
  const { resetCount, refresh: refreshUnreadCount } = useUnreadNotifications();
  const { t, language } = useI18n();

  const handleMarkAsRead = useCallback(async (notificationId: string) => {
    try {
      await markAsRead(notificationId);
      onUnreadCountChange?.();
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  }, [markAsRead, onUnreadCountChange]);

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await markAllAsRead();
      await resetCount();
      onUnreadCountChange?.();
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  }, [markAllAsRead, resetCount, onUnreadCountChange]);

  if (!isOpen) return null;

  const unreadNotifications = notifications.filter((n) => !n.read);
  const hasUnread = unreadNotifications.length > 0;

  return (
    <div
      className="fixed w-96 max-h-[480px] bg-white dark:bg-navy-700 rounded-xl shadow-2xl dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-charcoal-200 dark:border-navy-600/80 backdrop-blur-sm dark:backdrop-blur-md z-50 overflow-hidden flex flex-col"
      style={{
        top: `${position.top}px`,
        right: `${position.right}px`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-charcoal-200 dark:border-navy-600/60 bg-charcoal-50/30 dark:bg-navy-600/20">
        <h3 className="text-sm font-semibold text-charcoal-950 dark:text-white">
          {t('notifications.title')}
        </h3>
        {hasUnread && (
          <button
            onClick={handleMarkAllAsRead}
            className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium transition-colors"
          >
            {t('notifications.markAllAsRead')}
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <svg
              className="w-12 h-12 text-charcoal-300 dark:text-navy-500 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            <p className="text-sm text-charcoal-500 dark:text-gray-400">
              {t('notifications.noNotifications')}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-charcoal-100 dark:divide-navy-600/50">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                language={language}
                onMarkAsRead={handleMarkAsRead}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="border-t border-charcoal-200 dark:border-navy-600/60 px-4 py-2">
          <button
            onClick={onClose}
            className="w-full text-center text-xs text-charcoal-500 dark:text-gray-400 hover:text-charcoal-700 dark:hover:text-gray-300 font-medium py-1 transition-colors"
          >
            {t('common.close')}
          </button>
        </div>
      )}
    </div>
  );
}

export default memo(NotificationDropdown);
