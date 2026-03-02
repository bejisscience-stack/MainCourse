'use client';

import useSWR from 'swr';
import { useCallback } from 'react';

export interface ViewScraperSchedule {
  jobid: number | null;
  jobname: string;
  schedule: string | null;
  active: boolean;
}

export interface ViewScraperScheduleResult {
  schedule: ViewScraperSchedule | null;
  isLoading: boolean;
  error: string | null;
  updateSchedule: (cron: string) => Promise<boolean>;
  toggleActive: (active: boolean) => Promise<boolean>;
}

export function useViewScraperSchedule(): ViewScraperScheduleResult {
  const { data, isLoading, error, mutate } = useSWR(
    '/api/admin/view-scraper/schedule',
    async (url) => {
      const response = await fetch(url);
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to fetch schedule');
      }
      return response.json();
    },
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const schedule: ViewScraperSchedule | null = data?.schedule || null;

  const updateSchedule = useCallback(async (cron: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/admin/view-scraper/schedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule: cron }),
      });
      if (response.ok) {
        const result = await response.json();
        mutate({ schedule: result.schedule }, false);
        return true;
      }
      const err = await response.json().catch(() => ({}));
      console.error('Failed to update schedule:', err.error);
      return false;
    } catch (err) {
      console.error('Failed to update schedule:', err);
      return false;
    }
  }, [mutate]);

  const toggleActive = useCallback(async (active: boolean): Promise<boolean> => {
    try {
      const response = await fetch('/api/admin/view-scraper/schedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      });
      if (response.ok) {
        const result = await response.json();
        mutate({ schedule: result.schedule }, false);
        return true;
      }
      const err = await response.json().catch(() => ({}));
      console.error('Failed to toggle schedule:', err.error);
      return false;
    } catch (err) {
      console.error('Failed to toggle schedule:', err);
      return false;
    }
  }, [mutate]);

  return {
    schedule,
    isLoading,
    error: error?.message || null,
    updateSchedule,
    toggleActive,
  };
}
