'use client';

import useSWR from 'swr';
import { useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';

export interface AdminSubscriptionData {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  price: number;
  status: 'pending' | 'active' | 'expired' | 'rejected';
  created_at: string;
  payment_screenshot: string;
  approved_at: string | null;
}

export interface AdminProjectSubscriptionsResult {
  pending: AdminSubscriptionData[];
  active: AdminSubscriptionData[];
  rejected: AdminSubscriptionData[];
  all: AdminSubscriptionData[];
  isLoading: boolean;
  mutate: () => Promise<any>;
}

/**
 * Admin hook to fetch, monitor, and manage project subscriptions.
 * Provides realtime updates when subscriptions are created, approved, or rejected.
 */
export function useAdminProjectSubscriptions(): AdminProjectSubscriptionsResult {
  const supabase = createBrowserClient();

  const { data, isLoading, mutate } = useSWR(
    '/api/admin/project-subscriptions',
    async (url) => {
      const response = await fetch(url);
      if (!response.ok) return { subscriptions: [], counts: {} };
      return response.json();
    },
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const subscriptions: AdminSubscriptionData[] = data?.subscriptions || [];

  // Subscribe to realtime changes on project_subscriptions table
  useEffect(() => {
    const subscription = supabase
      .channel('admin_project_subscriptions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_subscriptions',
        },
        (payload) => {
          mutate();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, mutate]);

  return {
    pending: subscriptions.filter((s) => s.status === 'pending'),
    active: subscriptions.filter((s) => s.status === 'active'),
    rejected: subscriptions.filter((s) => s.status === 'rejected'),
    all: subscriptions,
    isLoading,
    mutate: () => mutate(),
  };
}
