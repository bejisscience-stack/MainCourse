import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import type { WithdrawalRequest } from '@/types/balance';

async function fetchAdminWithdrawalRequests(status?: string): Promise<WithdrawalRequest[]> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  
  if (!token) {
    throw new Error('Not authenticated');
  }

  const url = status && status !== 'all' 
    ? `/api/admin/withdrawals?status=${status}` 
    : '/api/admin/withdrawals';

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Cache-Control': 'no-cache',
    },
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

    await mutate();
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

    await mutate();
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

