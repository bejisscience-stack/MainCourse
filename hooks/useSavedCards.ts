'use client';

import useSWR from 'swr';
import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface SavedCard {
  id: string;
  cardMask: string;
  cardBrand: string | null;
  expirationDate: string | null;
  provider: string | null;
  createdAt: string;
}

async function getAuthToken(): Promise<string | null> {
  let { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    const { data: { session: refreshed } } = await supabase.auth.refreshSession();
    session = refreshed;
  }
  return session?.access_token || null;
}

async function fetchSavedCards(): Promise<SavedCard[]> {
  const token = await getAuthToken();
  if (!token) return [];

  const response = await fetch('/api/payments/saved-cards', {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) return [];

  const data = await response.json();
  return data.cards || [];
}

export function useSavedCards() {
  const { data: cards, error, isLoading, mutate } = useSWR<SavedCard[]>(
    'saved-cards',
    fetchSavedCards,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const deleteCard = useCallback(async (cardId: string): Promise<boolean> => {
    const token = await getAuthToken();
    if (!token) return false;

    const response = await fetch('/api/payments/saved-cards', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ cardId }),
    });

    if (response.ok) {
      mutate();
      return true;
    }
    return false;
  }, [mutate]);

  return {
    cards: cards || [],
    isLoading,
    error,
    deleteCard,
    mutate,
  };
}
