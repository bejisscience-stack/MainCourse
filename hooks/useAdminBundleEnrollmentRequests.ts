import useSWR from "swr";
import { supabase } from "@/lib/supabase";

export interface BundleEnrollmentRequest {
  id: string;
  user_id: string;
  bundle_id: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  updated_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
  payment_screenshots?: string[];
  profiles?: {
    id: string;
    username?: string;
    email?: string;
  } | null;
  bundles?: {
    id: string;
    title: string;
    price: number;
  } | null;
}

async function fetchAdminBundleEnrollmentRequests(
  status?: string,
): Promise<BundleEnrollmentRequest[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error("Not authenticated");
  }

  const url = `/api/admin/bundle-enrollment-requests`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const responseClone = response.clone();

    if (!response.ok) {
      let errorMessage = `Failed to fetch bundle enrollment requests (${response.status})`;
      try {
        const errorData = await response.json();
        errorMessage = errorData?.error || errorData?.details || errorMessage;
      } catch (e) {
        try {
          const text = await responseClone.text();
          if (text) {
            errorMessage = `Server error (${response.status}): ${text}`;
          }
        } catch (textError) {
          errorMessage = `Server error (${response.status}): ${response.statusText}`;
        }
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    let requests: BundleEnrollmentRequest[] = data.requests || [];

    // Client-side filter to ensure we reflect latest status changes even if server-side filtering lags
    if (status && status !== "all") {
      requests = requests.filter((r) => r.status === status);
    }

    return requests;
  } catch (error: any) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(
      error.message || "Failed to fetch bundle enrollment requests",
    );
  }
}

export function useAdminBundleEnrollmentRequests(status?: string) {
  // Always use the same cache key to avoid cache fragmentation
  // We fetch all requests and filter client-side
  const { data, error, isLoading, mutate } = useSWR<BundleEnrollmentRequest[]>(
    "admin-bundle-enrollment-requests-all", // Single cache key for all requests
    () => fetchAdminBundleEnrollmentRequests(undefined), // Always fetch all
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
      refreshInterval: 15000,
      fallbackData: [],
    },
  );

  // Filter client-side based on status
  const filteredRequests =
    status && status !== "all"
      ? (data || []).filter((r) => r.status === status)
      : data || [];

  // Helper to mutate - now just one cache key to invalidate
  const mutateAll = async () => {
    await mutate(undefined, { revalidate: true });
  };

  const approveRequest = async (requestId: string) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;

    if (!token) {
      throw new Error("Not authenticated");
    }

    const response = await fetch(
      `/api/admin/bundle-enrollment-requests/${requestId}/approve`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    const responseClone = response.clone();
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await responseClone.text();
      throw new Error(
        `Server returned non-JSON response (${response.status}): ${text.substring(0, 200)}`,
      );
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || data.details || "Failed to approve request",
      );
    }

    // Optimistically update the UI by changing the status to 'approved'
    // This ensures the client-side filter immediately excludes it from 'pending' view
    await mutate((currentData) => {
      if (!currentData) return currentData;
      return currentData.map((req) =>
        req.id === requestId
          ? {
              ...req,
              status: "approved" as const,
              updated_at: new Date().toISOString(),
            }
          : req,
      );
    }, false);

    // Then revalidate to get fresh data from server
    await mutateAll();

    return data;
  };

  const rejectRequest = async (requestId: string) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;

    if (!token) {
      throw new Error("Not authenticated");
    }

    const response = await fetch(
      `/api/admin/bundle-enrollment-requests/${requestId}/reject`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    const responseClone = response.clone();
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await responseClone.text();
      throw new Error(
        `Server returned non-JSON response (${response.status}): ${text.substring(0, 200)}`,
      );
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.details || "Failed to reject request");
    }

    // Optimistically update the UI by changing the status to 'rejected'
    // This ensures the client-side filter immediately excludes it from 'pending' view
    await mutate((currentData) => {
      if (!currentData) return currentData;
      return currentData.map((req) =>
        req.id === requestId
          ? {
              ...req,
              status: "rejected" as const,
              updated_at: new Date().toISOString(),
            }
          : req,
      );
    }, false);

    // Then revalidate to get fresh data from server
    await mutateAll();

    return data;
  };

  return {
    requests: filteredRequests, // Return filtered requests
    isLoading,
    error,
    mutate,
    approveRequest,
    rejectRequest,
  };
}
