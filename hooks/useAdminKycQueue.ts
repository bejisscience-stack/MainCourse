import useSWR from "swr";
import { supabase } from "@/lib/supabase";
import type { KycSubmission } from "@/types/kyc";

async function fetchAdminKycSubmissions(): Promise<KycSubmission[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error("Not authenticated");
  }

  const timestamp = Date.now();
  const url = `/api/admin/kyc?t=${timestamp}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Cache-Control": "no-cache",
    },
    cache: "no-store",
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error(`Server error (${response.status})`);
    }
    const errorData = await response.json();
    if (
      response.status === 500 &&
      errorData.error?.includes("does not exist")
    ) {
      return [];
    }
    throw new Error(errorData.error || "Failed to fetch KYC submissions");
  }

  const data = await response.json();
  return data.submissions || [];
}

export function useAdminKycQueue(status?: string) {
  const { data, error, isLoading, mutate } = useSWR<KycSubmission[]>(
    "admin-kyc-submissions-all",
    fetchAdminKycSubmissions,
    {
      revalidateOnFocus: false,
      dedupingInterval: 1000,
      refreshInterval: 10000,
      fallbackData: [],
      onError: (err) => {
        console.warn("[KYC Hook] Error:", err.message);
      },
    },
  );

  const filtered =
    status && status !== "all"
      ? (data || []).filter((s) => s.status === status)
      : data || [];

  const approveSubmission = async (
    submissionId: string,
    adminNotes?: string,
  ) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) throw new Error("Not authenticated");

    const response = await fetch(`/api/admin/kyc/${submissionId}/approve`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ adminNotes }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to approve KYC submission");
    }

    await mutate((curr) => {
      if (!curr) return curr;
      return curr.map((s) =>
        s.id === submissionId
          ? {
              ...s,
              status: "verified" as const,
              updated_at: new Date().toISOString(),
            }
          : s,
      );
    }, false);

    await mutate(undefined, { revalidate: true });
    return response.json();
  };

  const rejectSubmission = async (submissionId: string, adminNotes: string) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) throw new Error("Not authenticated");

    const response = await fetch(`/api/admin/kyc/${submissionId}/reject`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ adminNotes }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to reject KYC submission");
    }

    await mutate((curr) => {
      if (!curr) return curr;
      return curr.map((s) =>
        s.id === submissionId
          ? {
              ...s,
              status: "rejected" as const,
              admin_notes: adminNotes,
              updated_at: new Date().toISOString(),
            }
          : s,
      );
    }, false);

    await mutate(undefined, { revalidate: true });
    return response.json();
  };

  return {
    submissions: filtered,
    allSubmissions: data || [],
    isLoading,
    error,
    mutate,
    approveSubmission,
    rejectSubmission,
  };
}
