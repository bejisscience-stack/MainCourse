import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import type { BalanceInfo } from '@/types/balance';

async function fetchBalance(): Promise<BalanceInfo> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch('/api/balance', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Cache-Control': 'no-cache',
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch balance');
  }

  return response.json();
}

export function useBalance(userId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<BalanceInfo>(
    userId ? ['balance', userId] : null,
    fetchBalance,
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  const updateBankAccount = async (bankAccountNumber: string) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch('/api/balance', {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bankAccountNumber }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update bank account');
    }

    await mutate();
    return response.json();
  };

  const requestWithdrawal = async (amount: number, bankAccountNumber: string) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch('/api/withdrawals', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount, bankAccountNumber }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create withdrawal request');
    }

    await mutate();
    return response.json();
  };

  return {
    balance: data?.balance ?? 0,
    bankAccountNumber: data?.bankAccountNumber ?? null,
    pendingWithdrawal: data?.pendingWithdrawal ?? 0,
    totalEarned: data?.totalEarned ?? 0,
    totalWithdrawn: data?.totalWithdrawn ?? 0,
    transactions: data?.transactions ?? [],
    isLoading,
    error,
    mutate,
    updateBankAccount,
    requestWithdrawal,
  };
}

