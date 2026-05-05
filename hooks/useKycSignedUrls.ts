import useSWR from "swr";
import { supabase } from "@/lib/supabase";
import type { KycSignedUrls } from "@/types/kyc";

async function fetchSignedUrls(submissionId: string): Promise<KycSignedUrls> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const response = await fetch(`/api/admin/kyc/${submissionId}/signed-urls`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Cache-Control": "no-cache",
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to fetch signed URLs");
  }

  return response.json();
}

// Lazily fetched in the admin queue when a row is expanded.
// dedupingInterval is set just under the 5-min TTL on the server.
export function useKycSignedUrls(submissionId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<KycSignedUrls>(
    submissionId ? ["kyc-signed-urls", submissionId] : null,
    () => fetchSignedUrls(submissionId as string),
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 240_000,
    },
  );

  return {
    frontUrl: data?.frontUrl ?? null,
    backUrl: data?.backUrl ?? null,
    selfieUrl: data?.selfieUrl ?? null,
    isLoading,
    error,
    mutate,
  };
}
