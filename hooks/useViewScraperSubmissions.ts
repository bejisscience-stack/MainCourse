'use client';

import useSWR from 'swr';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { SubmissionWithViews, Platform } from '@/types/view-scraper';

export interface SubmissionFilters {
  projectId: string | null;
  platform: Platform | null;
}

export interface ViewScraperSubmissionsResult {
  submissions: SubmissionWithViews[];
  allSubmissions: SubmissionWithViews[];
  isLoading: boolean;
  filters: SubmissionFilters;
  setFilters: (filters: SubmissionFilters) => void;
  mutate: () => Promise<any>;
}

export function useViewScraperSubmissions(): ViewScraperSubmissionsResult {
  const [filters, setFilters] = useState<SubmissionFilters>({
    projectId: null,
    platform: null,
  });

  const { data, isLoading, mutate } = useSWR(
    '/api/admin/view-scraper/submissions',
    async (url) => {
      let { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        const { data: { session: refreshed } } = await supabase.auth.refreshSession();
        session = refreshed;
      }
      if (!session?.access_token) return { submissions: [] };
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (!response.ok) return { submissions: [] };
      return response.json();
    },
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const allSubmissions: SubmissionWithViews[] = data?.submissions || [];

  // Realtime subscription for latest_views updates
  useEffect(() => {
    const channel = supabase
      .channel('view_scraper_submissions')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'project_submissions' },
        () => { mutate(); }
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [mutate]);

  // Client-side filtering
  const submissions = useMemo(() => {
    let filtered = allSubmissions;

    if (filters.projectId) {
      filtered = filtered.filter((s) => s.project_id === filters.projectId);
    }

    if (filters.platform) {
      filtered = filtered.filter((s) => {
        // Check platform_links keys
        if (s.platform_links) {
          const hasMatchingLink = Object.values(s.platform_links).some((url) => {
            try {
              const hostname = new URL(url).hostname.toLowerCase();
              if (filters.platform === 'tiktok') return hostname.includes('tiktok.com');
              if (filters.platform === 'instagram') return hostname.includes('instagram.com');
            } catch { /* skip invalid urls */ }
            return false;
          });
          if (hasMatchingLink) return true;
        }
        // Check video_url
        if (s.video_url) {
          try {
            const hostname = new URL(s.video_url).hostname.toLowerCase();
            if (filters.platform === 'tiktok') return hostname.includes('tiktok.com');
            if (filters.platform === 'instagram') return hostname.includes('instagram.com');
          } catch { /* skip */ }
        }
        return false;
      });
    }

    return filtered;
  }, [allSubmissions, filters]);

  return {
    submissions,
    allSubmissions,
    isLoading,
    filters,
    setFilters,
    mutate: () => mutate(),
  };
}
