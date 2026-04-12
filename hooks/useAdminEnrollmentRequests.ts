import useSWR from "swr";
import { supabase } from "@/lib/supabase";
import type { EnrollmentRequest } from "./useEnrollmentRequests";

async function fetchAdminEnrollmentRequests(
  status?: string,
): Promise<EnrollmentRequest[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error("Not authenticated");
  }

  const url = `/api/admin/enrollment-requests`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // Clone the response to avoid "body stream already read" error
    const responseClone = response.clone();

    if (!response.ok) {
      let errorMessage = `Failed to fetch enrollment requests (${response.status})`;
      try {
        const errorData = await response.json();
        errorMessage = errorData?.error || errorData?.details || errorMessage;
      } catch (e) {
        // If response is not JSON, try to get text from clone
        try {
          const text = await responseClone.text();
          if (text) {
            errorMessage = `Server error (${response.status}): ${text}`;
          }
        } catch (textError) {
          // If both fail, use status text
          errorMessage = `Server error (${response.status}): ${response.statusText}`;
        }
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    let requests: EnrollmentRequest[] = data.requests || [];

    // Client-side filter to ensure we reflect latest status changes even if server-side filtering lags
    if (status && status !== "all") {
      requests = requests.filter((r) => r.status === status);
    }
    return requests;
  } catch (error: any) {
    // Re-throw with more context if it's not already an Error
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(error.message || "Failed to fetch enrollment requests");
  }
}

export function useAdminEnrollmentRequests(status?: string) {
  // Always use the same cache key to avoid cache fragmentation
  // We fetch all requests and filter client-side
  const { data, error, isLoading, mutate } = useSWR<EnrollmentRequest[]>(
    "admin-enrollment-requests-all", // Single cache key for all requests
    () => fetchAdminEnrollmentRequests(undefined), // Always fetch all
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
      `/api/admin/enrollment-requests/${requestId}/approve`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    // Clone response to avoid stream issues
    const responseClone = response.clone();

    // Check content type before parsing
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      // If not JSON, try to get text for error message
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
          ? { ...req, status: "approved", updated_at: new Date().toISOString() }
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
      `/api/admin/enrollment-requests/${requestId}/reject`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    // Clone response to avoid stream issues
    const responseClone = response.clone();

    // Check content type before parsing
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      // If not JSON, try to get text for error message
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
          ? { ...req, status: "rejected", updated_at: new Date().toISOString() }
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
