import { useState, useCallback } from "react";
import useSWR from "swr";
import { supabase } from "@/lib/supabase";
import type { LecturerAnalytics } from "@/types/analytics";

export type LecturerDateRangeKey = "7d" | "30d" | "90d" | "all";

function getDateRange(key: LecturerDateRangeKey): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().split("T")[0];
  if (key === "all") return { from: "2020-01-01", to };
  const daysMap: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
  const days = daysMap[key] ?? 30;
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  return { from, to };
}

async function fetchLecturerAnalytics(dateRange: {
  from: string;
  to: string;
}): Promise<LecturerAnalytics> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error("Not authenticated");
  }

  const params = `from=${dateRange.from}&to=${dateRange.to}`;
  const timestamp = Date.now();
  const response = await fetch(
    `/api/lecturer/analytics?${params}&t=${timestamp}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Cache-Control": "no-cache",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.error || `Failed to fetch analytics (${response.status})`,
    );
  }

  return response.json();
}

export interface LecturerAnalyticsResult {
  data: LecturerAnalytics | undefined;
  isLoading: boolean;
  error: Error | undefined;
  dateRangeKey: LecturerDateRangeKey;
  setDateRangeKey: (key: LecturerDateRangeKey) => void;
}

export function useLecturerAnalytics(): LecturerAnalyticsResult {
  const [dateRangeKey, setDateRangeKey] = useState<LecturerDateRangeKey>("30d");

  const dateRange = getDateRange(dateRangeKey);
  const swrKey = `lecturer-analytics-${dateRangeKey}-${dateRange.from}-${dateRange.to}`;

  const { data, error, isLoading } = useSWR(
    swrKey,
    () => fetchLecturerAnalytics(dateRange),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
      refreshInterval: 60000,
    },
  );

  const handleSetDateRange = useCallback((key: LecturerDateRangeKey) => {
    setDateRangeKey(key);
  }, []);

  return {
    data,
    isLoading,
    error,
    dateRangeKey,
    setDateRangeKey: handleSetDateRange,
  };
}
