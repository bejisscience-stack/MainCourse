import { useState, useCallback } from "react";
import useSWR from "swr";
import { supabase } from "@/lib/supabase";
import type {
  AnalyticsOverview,
  RevenueData,
  ReferralStats,
  ProjectStats,
  UserAnalytics,
  EngagementAnalytics,
  FinancialAnalytics,
  OperationalAnalytics,
} from "@/types/analytics";

export type DateRangeKey = "7d" | "30d" | "90d" | "1y" | "all";

function getDateRange(key: DateRangeKey): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().split("T")[0];
  if (key === "all") return { from: "2020-01-01", to };
  const days = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 }[key];
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  return { from, to };
}

async function fetchAnalytics<T>(endpoint: string): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error("Not authenticated");
  }

  const timestamp = Date.now();
  const separator = endpoint.includes("?") ? "&" : "?";
  const response = await fetch(`${endpoint}${separator}t=${timestamp}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Cache-Control": "no-cache",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.error || `Failed to fetch ${endpoint} (${response.status})`,
    );
  }

  return response.json();
}

interface OriginalAnalytics {
  overview: AnalyticsOverview;
  revenue: RevenueData;
  referrals: ReferralStats;
  projects: ProjectStats;
}

interface ExtendedAnalytics {
  users: UserAnalytics;
  engagement: EngagementAnalytics;
  financial: FinancialAnalytics;
  operational: OperationalAnalytics;
}

async function fetchOriginalAnalytics(): Promise<OriginalAnalytics> {
  const [overview, revenue, referrals, projects] = await Promise.all([
    fetchAnalytics<AnalyticsOverview>("/api/admin/analytics/overview"),
    fetchAnalytics<RevenueData>("/api/admin/analytics/revenue"),
    fetchAnalytics<ReferralStats>("/api/admin/analytics/referrals"),
    fetchAnalytics<ProjectStats>("/api/admin/analytics/projects"),
  ]);
  return { overview, revenue, referrals, projects };
}

async function fetchExtendedAnalytics(dateRange: {
  from: string;
  to: string;
}): Promise<ExtendedAnalytics> {
  const params = `from=${dateRange.from}&to=${dateRange.to}`;
  const [users, engagement, financial, operational] = await Promise.all([
    fetchAnalytics<UserAnalytics>(`/api/admin/analytics/users?${params}`),
    fetchAnalytics<EngagementAnalytics>(
      `/api/admin/analytics/engagement?${params}`,
    ),
    fetchAnalytics<FinancialAnalytics>(
      `/api/admin/analytics/financial?${params}`,
    ),
    fetchAnalytics<OperationalAnalytics>("/api/admin/analytics/operational"),
  ]);
  return { users, engagement, financial, operational };
}

export interface AdminAnalyticsResult {
  overview: AnalyticsOverview | undefined;
  revenue: RevenueData | undefined;
  referrals: ReferralStats | undefined;
  projects: ProjectStats | undefined;
  users: UserAnalytics | undefined;
  engagement: EngagementAnalytics | undefined;
  financial: FinancialAnalytics | undefined;
  operational: OperationalAnalytics | undefined;
  isLoading: boolean;
  error: Error | undefined;
  dateRangeKey: DateRangeKey;
  setDateRangeKey: (key: DateRangeKey) => void;
}

export function useAdminAnalytics(): AdminAnalyticsResult {
  const [dateRangeKey, setDateRangeKey] = useState<DateRangeKey>("30d");
  const dateRange = getDateRange(dateRangeKey);

  const {
    data: originalData,
    error: originalError,
    isLoading: originalLoading,
  } = useSWR("admin-analytics", fetchOriginalAnalytics, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
    refreshInterval: 30000,
  });

  const {
    data: extendedData,
    error: extendedError,
    isLoading: extendedLoading,
  } = useSWR(
    `admin-analytics-extended-${dateRangeKey}`,
    () => fetchExtendedAnalytics(dateRange),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
      refreshInterval: 30000,
    },
  );

  const handleSetDateRange = useCallback((key: DateRangeKey) => {
    setDateRangeKey(key);
  }, []);

  return {
    overview: originalData?.overview,
    revenue: originalData?.revenue,
    referrals: originalData?.referrals,
    projects: originalData?.projects,
    users: extendedData?.users,
    engagement: extendedData?.engagement,
    financial: extendedData?.financial,
    operational: extendedData?.operational,
    isLoading: originalLoading || extendedLoading,
    error: originalError || extendedError,
    dateRangeKey,
    setDateRangeKey: handleSetDateRange,
  };
}
