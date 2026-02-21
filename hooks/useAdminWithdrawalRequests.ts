import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import type { WithdrawalRequest } from '@/types/balance';

async function fetchAdminWithdrawalRequests(status?: string): Promise<WithdrawalRequest[]> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  
  if (!token) {
    throw new Error('Not authenticated');
  }

  // Add timestamp to bust any caching
  const timestamp = Date.now();
  const url = status && status !== 'all'
    ? `/api/admin/withdrawals?status=${status}&t=${timestamp}`
    : `/api/admin/withdrawals?t=${timestamp}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Cache-Control': 'no-cache',
    },
    cache: 'no-store',
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    const errorData = await response.json();
    // If withdrawal system isn't configured yet, return empty array instead of error
    if (response.status === 500 && errorData.error?.includes('does not exist')) {
      return [];
    }
    throw new Error(errorData.error || 'Failed to fetch withdrawal requests');
  }

  const data = await response.json();
  return data.requests || [];
}

export function useAdminWithdrawalRequests(status?: string) {
  const { data, error, isLoading, mutate } = useSWR<WithdrawalRequest[]>(
    'admin-withdrawal-requests-all',
    () => fetchAdminWithdrawalRequests(undefined),
    {
      revalidateOnFocus: true,
      dedupingInterval: 1000,
      refreshInterval: 10000, // Reduce frequency since this feature may not be active yet
      fallbackData: [], // Default to empty array
      onError: (err) => {
        // Silently handle errors when withdrawal system isn't configured
        console.warn('[Withdrawal Hook] Error:', err.message);
      },
    }
  );

  // Filter client-side based on status
  const filteredRequests = status && status !== 'all'
    ? (data || []).filter(r => r.status === status)
    : (data || []);

  const approveRequest = async (requestId: string, adminNotes?: string) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`/api/admin/withdrawals/${requestId}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ adminNotes }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to approve withdrawal request');
    }

    // Optimistic update - set status to 'completed'
    // This ensures the client-side filter immediately excludes it from 'pending' view
    await mutate((currentData) => {
      if (!currentData) return currentData;
      return currentData.map(req =>
        req.id === requestId
          ? { ...req, status: 'completed', updated_at: new Date().toISOString() }
          : req
      );
    }, false);

    // Then revalidate to get fresh data including updated profile balance
    await mutate(undefined, { revalidate: true });
    return response.json();
  };

  const rejectRequest = async (requestId: string, adminNotes?: string) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`/api/admin/withdrawals/${requestId}/reject`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ adminNotes }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to reject withdrawal request');
    }

    // Optimistic update - set status to 'rejected'
    // This ensures the client-side filter immediately excludes it from 'pending' view
    await mutate((currentData) => {
      if (!currentData) return currentData;
      return currentData.map(req =>
        req.id === requestId
          ? { ...req, status: 'rejected', updated_at: new Date().toISOString() }
          : req
      );
    }, false);

    // Then revalidate to get fresh data
    await mutate(undefined, { revalidate: true });
    return response.json();
  };

  return {
    requests: filteredRequests,
    isLoading,
    error,
    mutate,
    approveRequest,
    rejectRequest,
  };
}

