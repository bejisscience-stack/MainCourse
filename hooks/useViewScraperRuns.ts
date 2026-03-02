'use client';

import useSWR from 'swr';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { ViewScrapeRun } from '@/types/view-scraper';

export interface ViewScraperRunsResult {
  runs: ViewScrapeRun[];
  activeRun: ViewScrapeRun | null;
  isRunning: boolean;
  isLoading: boolean;
  error: string | null;
  triggerRun: (projectId?: string) => Promise<{ run_id: string } | null>;
  triggerCheck: (submissionId: string) => Promise<{ run_id: string } | null>;
  mutate: () => Promise<any>;
  clearError: () => void;
}

export function useViewScraperRuns(): ViewScraperRunsResult {
  const [error, setError] = useState<string | null>(null);

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
      setError(null);
      let { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        const { data: { session: refreshed } } = await supabase.auth.refreshSession();
        session = refreshed;
      }
      if (!session?.access_token) {
        setError('Not authenticated. Please log in again.');
        return null;
      }
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
      setError(result.error || `Failed to trigger run (${response.status})`);
      return null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error triggering run');
      return null;
    }
  }, [mutate]);

  const triggerCheck = useCallback(async (submissionId: string) => {
    try {
      setError(null);
      let { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        const { data: { session: refreshed } } = await supabase.auth.refreshSession();
        session = refreshed;
      }
      if (!session?.access_token) {
        setError('Not authenticated. Please log in again.');
        return null;
      }
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
      setError(result.error || `Failed to trigger check (${response.status})`);
      return null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error triggering check');
      return null;
    }
  }, [mutate]);

  const clearError = useCallback(() => setError(null), []);

  return {
    runs,
    activeRun,
    isRunning,
    isLoading,
    error,
    triggerRun,
    triggerCheck,
    mutate: () => mutate(),
    clearError,
  };
}
