import type { Language } from '@/lib/i18n';

export type NotificationType =
  | 'enrollment_approved'
  | 'enrollment_rejected'
  | 'bundle_enrollment_approved'
  | 'bundle_enrollment_rejected'
  | 'withdrawal_approved'
  | 'withdrawal_rejected'
  | 'admin_message'
  | 'system';

export interface MultilingualText {
  en: string;
  ge: string;
}

export interface NotificationMetadata {
  course_id?: string;
  course_title?: string;
  bundle_id?: string;
  bundle_title?: string;
  request_id?: string;
  amount?: number;
  [key: string]: string | number | boolean | undefined;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: MultilingualText;
  message: MultilingualText;
  read: boolean;
  read_at: string | null;
  metadata: NotificationMetadata;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface NotificationWithProfile extends Notification {
  profiles?: {
    id: string;
    username: string | null;
    email: string;
  };
}

export interface CreateNotificationPayload {
  user_id: string;
  type: NotificationType;
  title: MultilingualText;
  message: MultilingualText;
  metadata?: NotificationMetadata;
  created_by?: string;
}

export interface AdminNotificationPayload {
  target_type: 'all' | 'role' | 'course' | 'specific';
  target_role?: 'student' | 'lecturer' | 'admin';
  target_course_id?: string;
  target_user_ids?: string[];
  title: MultilingualText;
  message: MultilingualText;
}

export interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface UnreadCountResponse {
  count: number;
}

// Helper to get localized text from multilingual object
export function getLocalizedText(
  text: MultilingualText | string | null | undefined,
  language: Language
): string {
  if (!text) return '';
  if (typeof text === 'string') return text;
  return text[language] || text.en || '';
}

// Notification icon types for UI
export const notificationIcons: Record<NotificationType, string> = {
  enrollment_approved: 'check-circle',
  enrollment_rejected: 'x-circle',
  bundle_enrollment_approved: 'check-circle',
  bundle_enrollment_rejected: 'x-circle',
  withdrawal_approved: 'currency-dollar',
  withdrawal_rejected: 'x-circle',
  admin_message: 'megaphone',
  system: 'information-circle',
};

// Notification colors for UI
export const notificationColors: Record<NotificationType, { bg: string; text: string; icon: string }> = {
  enrollment_approved: {
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    text: 'text-emerald-700 dark:text-emerald-400',
    icon: 'text-emerald-500',
  },
  enrollment_rejected: {
    bg: 'bg-red-50 dark:bg-red-500/10',
    text: 'text-red-700 dark:text-red-400',
    icon: 'text-red-500',
  },
  bundle_enrollment_approved: {
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    text: 'text-emerald-700 dark:text-emerald-400',
    icon: 'text-emerald-500',
  },
  bundle_enrollment_rejected: {
    bg: 'bg-red-50 dark:bg-red-500/10',
    text: 'text-red-700 dark:text-red-400',
    icon: 'text-red-500',
  },
  withdrawal_approved: {
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    text: 'text-emerald-700 dark:text-emerald-400',
    icon: 'text-emerald-500',
  },
  withdrawal_rejected: {
    bg: 'bg-red-50 dark:bg-red-500/10',
    text: 'text-red-700 dark:text-red-400',
    icon: 'text-red-500',
  },
  admin_message: {
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    text: 'text-emerald-700 dark:text-emerald-400',
    icon: 'text-emerald-500',
  },
  system: {
    bg: 'bg-charcoal-50 dark:bg-charcoal-500/10',
    text: 'text-charcoal-700 dark:text-charcoal-400',
    icon: 'text-charcoal-500',
  },
};
