'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { ViewScraperProgress } from '@/types/view-scraper';

export interface ViewScraperLiveResult {
  progress: ViewScraperProgress;
  isActive: boolean;
}

export function useViewScraperLive(activeRunId: string | null): ViewScraperLiveResult {
  const [progress, setProgress] = useState<ViewScraperProgress>({
    completed: 0,
    total: 0,
    lastUrl: null,
  });
  const [isActive, setIsActive] = useState(false);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!activeRunId) {
      setIsActive(false);
      setProgress({ completed: 0, total: 0, lastUrl: null });
      return;
    }

    setIsActive(true);

    const channel = supabase
      .channel(`view_scraper_live_${activeRunId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'view_scrape_results',
          filter: `scrape_run_id=eq.${activeRunId}`,
        },
        (payload) => {
          const result = payload.new;
          setProgress((prev) => ({
            completed: prev.completed + 1,
            total: prev.total,
            lastUrl: result.video_url || prev.lastUrl,
          }));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'view_scrape_runs',
          filter: `id=eq.${activeRunId}`,
        },
        (payload) => {
          const run = payload.new;
          setProgress((prev) => ({
            ...prev,
            total: run.total_urls || prev.total,
          }));
          if (run.status === 'completed' || run.status === 'failed') {
            setIsActive(false);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [activeRunId]);

  return { progress, isActive };
}
