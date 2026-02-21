import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import type {
  AnalyticsOverview,
  RevenueData,
  ReferralStats,
  ProjectStats,
} from '@/types/analytics';

interface AdminAnalytics {
  overview: AnalyticsOverview | undefined;
  revenue: RevenueData | undefined;
  referrals: ReferralStats | undefined;
  projects: ProjectStats | undefined;
  isLoading: boolean;
  error: Error | undefined;
}

async function fetchAnalytics<T>(endpoint: string): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error('Not authenticated');
  }

  const timestamp = Date.now();
  const response = await fetch(`${endpoint}?t=${timestamp}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Cache-Control': 'no-cache',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.error || `Failed to fetch ${endpoint} (${response.status})`
    );
  }

  return response.json();
}

async function fetchAllAnalytics(): Promise<{
  overview: AnalyticsOverview;
  revenue: RevenueData;
  referrals: ReferralStats;
  projects: ProjectStats;
}> {
  const [overview, revenue, referrals, projects] = await Promise.all([
    fetchAnalytics<AnalyticsOverview>('/api/admin/analytics/overview'),
    fetchAnalytics<RevenueData>('/api/admin/analytics/revenue'),
    fetchAnalytics<ReferralStats>('/api/admin/analytics/referrals'),
    fetchAnalytics<ProjectStats>('/api/admin/analytics/projects'),
  ]);

  return { overview, revenue, referrals, projects };
}

export function useAdminAnalytics(): AdminAnalytics {
  const { data, error, isLoading } = useSWR(
    'admin-analytics',
    fetchAllAnalytics,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
      refreshInterval: 30000,
    }
  );

  return {
    overview: data?.overview,
    revenue: data?.revenue,
    referrals: data?.referrals,
    projects: data?.projects,
    isLoading,
    error,
  };
}
