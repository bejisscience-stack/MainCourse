import useSWR from "swr";
import { supabase } from "@/lib/supabase";
import type { KycStatusResponse } from "@/types/kyc";

async function fetchKycStatus(): Promise<KycStatusResponse> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error("Not authenticated");
  }

  const response = await fetch("/api/kyc/status", {
    headers: {
      Authorization: `Bearer ${token}`,
      "Cache-Control": "no-cache",
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to fetch KYC status");
  }

  return response.json();
}

export function useKycStatus(userId: string | null | undefined) {
  const { data, error, isLoading, mutate } = useSWR<KycStatusResponse>(
    userId ? ["kyc-status", userId] : null,
    fetchKycStatus,
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    },
  );

  return {
    status: data?.status ?? "not_submitted",
    submission: data?.submission ?? null,
    isLoading,
    error,
    mutate,
  };
}
