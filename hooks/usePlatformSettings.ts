import useSWR from "swr";
import { supabase } from "@/lib/supabase";

interface PlatformSettings {
  min_withdrawal_gel: number;
  subscription_price_gel: number;
  updated_at?: string;
  updated_by?: string;
}

const DEFAULTS: PlatformSettings = {
  min_withdrawal_gel: 50,
  subscription_price_gel: 10,
};

async function fetchPlatformSettings(): Promise<PlatformSettings> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    return DEFAULTS;
  }

  const response = await fetch("/api/admin/settings", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return DEFAULTS;
  }

  return response.json();
}

export function usePlatformSettings() {
  const { data, error, isLoading, mutate } = useSWR<PlatformSettings>(
    "platform-settings",
    fetchPlatformSettings,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // cache for 1 minute
      fallbackData: DEFAULTS,
    },
  );

  return {
    minWithdrawal: data?.min_withdrawal_gel ?? DEFAULTS.min_withdrawal_gel,
    subscriptionPrice:
      data?.subscription_price_gel ?? DEFAULTS.subscription_price_gel,
    updatedAt: data?.updated_at,
    updatedBy: data?.updated_by,
    isLoading,
    error,
    mutate,
  };
}
