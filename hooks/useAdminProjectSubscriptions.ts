'use client';

import useSWR from 'swr';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

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
  approveSubscription: (id: string) => Promise<void>;
  rejectSubscription: (id: string) => Promise<void>;
}

async function getToken(): Promise<string> {
  let { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    const { data: { session: refreshed } } = await supabase.auth.refreshSession();
    session = refreshed;
  }
  if (!session?.access_token) throw new Error('Not authenticated');
  return session.access_token;
}

/**
 * Admin hook to fetch, monitor, and manage project subscriptions.
 * Provides realtime updates when subscriptions are created, approved, or rejected.
 */
export function useAdminProjectSubscriptions(): AdminProjectSubscriptionsResult {

  const { data, isLoading, mutate } = useSWR(
    'admin-project-subscriptions',
    async () => {
      const token = await getToken();
      const response = await fetch('/api/admin/project-subscriptions', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) return { subscriptions: [] };
      return response.json();
    },
    { revalidateOnFocus: true, dedupingInterval: 5000 }
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
        () => {
          mutate();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [mutate]);

  const approveSubscription = async (id: string) => {
    const token = await getToken();
    const response = await fetch(`/api/admin/project-subscriptions/${id}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to approve' }));
      throw new Error(err.error || 'Failed to approve subscription');
    }

    // Optimistic update then revalidate
    await mutate((current: any) => {
      if (!current?.subscriptions) return current;
      return {
        ...current,
        subscriptions: current.subscriptions.map((s: AdminSubscriptionData) =>
          s.id === id ? { ...s, status: 'active' as const } : s
        ),
      };
    }, false);
    await mutate();
  };

  const rejectSubscription = async (id: string) => {
    const token = await getToken();
    const response = await fetch(`/api/admin/project-subscriptions/${id}/reject`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to reject' }));
      throw new Error(err.error || 'Failed to reject subscription');
    }

    // Optimistic update then revalidate
    await mutate((current: any) => {
      if (!current?.subscriptions) return current;
      return {
        ...current,
        subscriptions: current.subscriptions.map((s: AdminSubscriptionData) =>
          s.id === id ? { ...s, status: 'rejected' as const } : s
        ),
      };
    }, false);
    await mutate();
  };

  return {
    pending: subscriptions.filter((s) => s.status === 'pending'),
    active: subscriptions.filter((s) => s.status === 'active'),
    rejected: subscriptions.filter((s) => s.status === 'rejected'),
    all: subscriptions,
    isLoading,
    mutate: () => mutate(),
    approveSubscription,
    rejectSubscription,
  };
}
