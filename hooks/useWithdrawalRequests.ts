import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import type { WithdrawalRequest } from '@/types/balance';

async function fetchWithdrawalRequests(): Promise<WithdrawalRequest[]> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch('/api/withdrawals', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Cache-Control': 'no-cache',
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch withdrawal requests');
  }

  const data = await response.json();
  return data.requests || [];
}

export function useWithdrawalRequests(userId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<WithdrawalRequest[]>(
    userId ? ['withdrawal-requests', userId] : null,
    fetchWithdrawalRequests,
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  return {
    requests: data || [],
    isLoading,
    error,
    mutate,
  };
}

