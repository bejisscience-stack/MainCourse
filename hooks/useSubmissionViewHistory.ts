'use client';

import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import type { ViewScrapeResult } from '@/types/view-scraper';

export interface SubmissionViewHistoryResult {
  history: ViewScrapeResult[];
  isLoading: boolean;
}

export function useSubmissionViewHistory(submissionId: string | null): SubmissionViewHistoryResult {
  const { data, isLoading } = useSWR(
    submissionId ? `/api/admin/view-scraper/history/${submissionId}` : null,
    async (url) => {
      let { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        const { data: { session: refreshed } } = await supabase.auth.refreshSession();
        session = refreshed;
      }
      if (!session?.access_token) return { history: [] };
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (!response.ok) return { history: [] };
      return response.json();
    },
    { revalidateOnFocus: false, dedupingInterval: 10000 }
  );

  return {
    history: data?.history || [],
    isLoading,
  };
}
