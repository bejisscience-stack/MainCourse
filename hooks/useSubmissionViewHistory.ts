'use client';

import useSWR from 'swr';
import type { ViewScrapeResult } from '@/types/view-scraper';

export interface SubmissionViewHistoryResult {
  history: ViewScrapeResult[];
  isLoading: boolean;
}

export function useSubmissionViewHistory(submissionId: string | null): SubmissionViewHistoryResult {
  const { data, isLoading } = useSWR(
    submissionId ? `/api/admin/view-scraper/history/${submissionId}` : null,
    async (url) => {
      const response = await fetch(url);
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
