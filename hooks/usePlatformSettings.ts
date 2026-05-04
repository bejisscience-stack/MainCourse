import useSWR from "swr";
import { supabase } from "@/lib/supabase";
import { useAdminRealtimeInvalidation } from "@/hooks/useAdminRealtimeInvalidation";

interface PlatformSettings {
  min_withdrawal_gel: number;
  subscription_price_gel: number;
  featured_course_id: string | null;
  updated_at?: string;
  updated_by?: string;
}

const DEFAULTS: PlatformSettings = {
  min_withdrawal_gel: 50,
  subscription_price_gel: 10,
  featured_course_id: null,
};

const PLATFORM_SETTINGS_LIVE_TABLES = ["platform_settings"] as const;

async function fetchPlatformSettings(): Promise<PlatformSettings> {
  let {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    const {
      data: { session: refreshed },
    } = await supabase.auth.refreshSession();
    session = refreshed;
  }

  const token = session?.access_token;
  if (!token) {
    throw new Error("Not authenticated");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch("/api/admin/settings", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Cache-Control": "no-cache",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export function usePlatformSettings() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<PlatformSettings>(
    "platform-settings",
    fetchPlatformSettings,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // cache for 1 minute
      fallbackData: DEFAULTS,
    },
  );

  useAdminRealtimeInvalidation({
    channelName: "platform-settings-live",
    tables: PLATFORM_SETTINGS_LIVE_TABLES,
    onChange: () => {
      void mutate();
    },
  });

  return {
    minWithdrawal: data?.min_withdrawal_gel ?? DEFAULTS.min_withdrawal_gel,
    subscriptionPrice:
      data?.subscription_price_gel ?? DEFAULTS.subscription_price_gel,
    featuredCourseId: data?.featured_course_id ?? null,
    updatedAt: data?.updated_at,
    updatedBy: data?.updated_by,
    isLoading: isLoading && !data,
    isValidating,
    error,
    mutate,
  };
}
