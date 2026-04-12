import { useState, useCallback } from "react";
import useSWR from "swr";
import { supabase } from "@/lib/supabase";
import type {
  AnalyticsOverview,
  RevenueData,
  ReferralStats,
  FinancialAnalytics,
  OperationalAnalytics,
} from "@/types/analytics";

export type DateRangeKey = "7d" | "30d" | "90d" | "1y" | "all" | "custom";

function getDateRange(
  key: DateRangeKey,
  customFrom?: string,
  customTo?: string,
): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().split("T")[0];
  if (key === "custom" && customFrom && customTo)
    return { from: customFrom, to: customTo };
  if (key === "all") return { from: "2020-01-01", to };
  const daysMap: Record<string, number> = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
    "1y": 365,
  };
  const days = daysMap[key] ?? 30;
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

interface AllAnalytics {
  overview: AnalyticsOverview;
  revenue: RevenueData;
  referrals: ReferralStats;
  financial: FinancialAnalytics;
  operational: OperationalAnalytics;
  fetchedAt: number;
}

async function fetchAllAnalytics(dateRange: {
  from: string;
  to: string;
}): Promise<AllAnalytics> {
  const params = `from=${dateRange.from}&to=${dateRange.to}`;
  const [overview, revenue, referrals, financial, operational] =
    await Promise.all([
      fetchAnalytics<AnalyticsOverview>(
        `/api/admin/analytics/overview?${params}`,
      ),
      fetchAnalytics<RevenueData>(`/api/admin/analytics/revenue?${params}`),
      fetchAnalytics<ReferralStats>(`/api/admin/analytics/referrals?${params}`),
      fetchAnalytics<FinancialAnalytics>(
        `/api/admin/analytics/financial?${params}`,
      ),
      fetchAnalytics<OperationalAnalytics>("/api/admin/analytics/operational"),
    ]);
  return {
    overview,
    revenue,
    referrals,
    financial,
    operational,
    fetchedAt: Date.now(),
  };
}

export interface AdminAnalyticsResult {
  overview: AnalyticsOverview | undefined;
  revenue: RevenueData | undefined;
  referrals: ReferralStats | undefined;
  financial: FinancialAnalytics | undefined;
  operational: OperationalAnalytics | undefined;
  isLoading: boolean;
  error: Error | undefined;
  dateRangeKey: DateRangeKey;
  setDateRangeKey: (key: DateRangeKey) => void;
  customFrom: string;
  customTo: string;
  setCustomDateRange: (from: string, to: string) => void;
  lastUpdated: number | undefined;
}

export function useAdminAnalytics(): AdminAnalyticsResult {
  const [dateRangeKey, setDateRangeKey] = useState<DateRangeKey>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const dateRange = getDateRange(dateRangeKey, customFrom, customTo);
  const swrKey = `admin-analytics-${dateRangeKey}-${dateRange.from}-${dateRange.to}`;

  const { data, error, isLoading } = useSWR(
    swrKey,
    () => fetchAllAnalytics(dateRange),
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

  const handleSetCustomDateRange = useCallback((from: string, to: string) => {
    setCustomFrom(from);
    setCustomTo(to);
    setDateRangeKey("custom");
  }, []);

  return {
    overview: data?.overview,
    revenue: data?.revenue,
    referrals: data?.referrals,
    financial: data?.financial,
    operational: data?.operational,
    isLoading,
    error,
    dateRangeKey,
    setDateRangeKey: handleSetDateRange,
    customFrom,
    customTo,
    setCustomDateRange: handleSetCustomDateRange,
    lastUpdated: data?.fetchedAt,
  };
}
