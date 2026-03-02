'use client';

import useSWR from 'swr';
import { useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { ViewScrapeRun } from '@/types/view-scraper';

export interface ViewScraperRunsResult {
  runs: ViewScrapeRun[];
  activeRun: ViewScrapeRun | null;
  isRunning: boolean;
  isLoading: boolean;
  triggerRun: (projectId?: string) => Promise<{ run_id: string } | null>;
  triggerCheck: (submissionId: string) => Promise<{ run_id: string } | null>;
  mutate: () => Promise<any>;
}

export function useViewScraperRuns(): ViewScraperRunsResult {
  const { data, isLoading, mutate } = useSWR(
    '/api/admin/view-scraper/runs',
    async (url) => {
      let { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        const { data: { session: refreshed } } = await supabase.auth.refreshSession();
        session = refreshed;
      }
      if (!session?.access_token) return { runs: [] };
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (!response.ok) return { runs: [] };
      return response.json();
    },
    { revalidateOnFocus: false, dedupingInterval: 10000 }
  );

  const runs: ViewScrapeRun[] = data?.runs || [];
  const activeRun = runs.find((r) => r.status === 'running') || null;
  const isRunning = activeRun !== null;

  // Realtime subscription for run status updates
  useEffect(() => {
    const channel = supabase
      .channel('view_scrape_runs_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'view_scrape_runs' },
        () => { mutate(); }
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [mutate]);

  const triggerRun = useCallback(async (projectId?: string) => {
    try {
      let { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        const { data: { session: refreshed } } = await supabase.auth.refreshSession();
        session = refreshed;
      }
      if (!session?.access_token) return null;
      const response = await fetch('/api/admin/view-scraper/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ project_id: projectId || null }),
      });
      const result = await response.json();
      if (response.ok) {
        mutate();
        return result;
      }
      console.error('Failed to trigger run:', result.error);
      return null;
    } catch (err) {
      console.error('Failed to trigger run:', err);
      return null;
    }
  }, [mutate]);

  const triggerCheck = useCallback(async (submissionId: string) => {
    try {
      let { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        const { data: { session: refreshed } } = await supabase.auth.refreshSession();
        session = refreshed;
      }
      if (!session?.access_token) return null;
      const response = await fetch('/api/admin/view-scraper/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ submission_id: submissionId }),
      });
      const result = await response.json();
      if (response.ok) {
        mutate();
        return result;
      }
      console.error('Failed to trigger check:', result.error);
      return null;
    } catch (err) {
      console.error('Failed to trigger check:', err);
      return null;
    }
  }, [mutate]);

  return {
    runs,
    activeRun,
    isRunning,
    isLoading,
    triggerRun,
    triggerCheck,
    mutate: () => mutate(),
  };
}
