'use client';

import useSWR from 'swr';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { ViewScrapeResultEnriched } from '@/types/view-scraper';

export interface ViewScraperRunResultsReturn {
  results: ViewScrapeResultEnriched[];
  isLoading: boolean;
}

export function useViewScraperRunResults(runId: string | null): ViewScraperRunResultsReturn {
  const { data, isLoading, mutate } = useSWR(
    runId ? `/api/admin/view-scraper/runs/${runId}/results` : null,
    async (url) => {
      let { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        const { data: { session: refreshed } } = await supabase.auth.refreshSession();
        session = refreshed;
      }
      if (!session?.access_token) return { results: [] };
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (!response.ok) return { results: [] };
      return response.json();
    },
    { revalidateOnFocus: false, dedupingInterval: 10000 }
  );

  // Realtime: revalidate when new results are inserted for this run
  useEffect(() => {
    if (!runId) return;

    const channel = supabase
      .channel(`view_scrape_results_run_${runId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'view_scrape_results',
          filter: `scrape_run_id=eq.${runId}`,
        },
        () => { mutate(); }
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [runId, mutate]);

  return {
    results: data?.results || [],
    isLoading,
  };
}
