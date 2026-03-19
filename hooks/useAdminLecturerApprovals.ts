import useSWR from "swr";
import { supabase } from "@/lib/supabase";

export interface LecturerApproval {
  id: string;
  email: string;
  full_name: string;
  username: string;
  is_approved: boolean | null;
  lecturer_status: "pending" | "approved" | "rejected" | null;
  created_at: string;
  updated_at: string;
}

async function fetchAdminLecturerApprovals(): Promise<LecturerApproval[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error("Not authenticated");
  }

  const timestamp = Date.now();
  const url = `/api/admin/lecturer-approvals?t=${timestamp}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Cache-Control": "no-cache",
    },
    cache: "no-store",
    next: { revalidate: 0 },
  });

  const responseClone = response.clone();

  if (!response.ok) {
    let errorMessage = `Failed to fetch lecturer approvals (${response.status})`;
    try {
      const errorData = await response.json();
      errorMessage = errorData?.error || errorMessage;
    } catch {
      try {
        const text = await responseClone.text();
        if (text) errorMessage = `Server error (${response.status}): ${text}`;
      } catch {
        errorMessage = `Server error (${response.status}): ${response.statusText}`;
      }
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return data.lecturers || [];
}

export function useAdminLecturerApprovals(status?: string) {
  const { data, error, isLoading, mutate } = useSWR<LecturerApproval[]>(
    "admin-lecturer-approvals-all",
    () => fetchAdminLecturerApprovals(),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 1000,
      refreshInterval: 5000,
      fallbackData: [],
      onError: (error) => {
        console.error("[Lecturer Approvals Hook] SWR error:", error);
      },
    },
  );

  // Filter client-side based on status
  const filteredLecturers = (() => {
    const all = data || [];
    if (!status || status === "all") return all;
    if (status === "pending")
      return all.filter((l) => l.lecturer_status === "pending");
    if (status === "approved")
      return all.filter((l) => l.lecturer_status === "approved");
    if (status === "rejected")
      return all.filter((l) => l.lecturer_status === "rejected");
    return all;
  })();

  const approveLecturer = async (lecturerId: string) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;

    if (!token) {
      throw new Error("Not authenticated");
    }

    const response = await fetch(
      `/api/admin/lecturer-approvals/${lecturerId}/approve`,
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

    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(responseData.error || "Failed to approve lecturer");
    }

    // Optimistic update — refreshInterval (5s) will confirm from DB
    await mutate((currentData) => {
      if (!currentData) return currentData;
      return currentData.map((l) =>
        l.id === lecturerId
          ? {
              ...l,
              is_approved: true,
              lecturer_status: "approved" as const,
              updated_at: new Date().toISOString(),
            }
          : l,
      );
    }, false);

    return responseData;
  };

  const rejectLecturer = async (lecturerId: string, reason?: string) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;

    if (!token) {
      throw new Error("Not authenticated");
    }

    const response = await fetch(
      `/api/admin/lecturer-approvals/${lecturerId}/reject`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason }),
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

    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(responseData.error || "Failed to reject lecturer");
    }

    // Optimistic update — refreshInterval (5s) will confirm from DB
    await mutate((currentData) => {
      if (!currentData) return currentData;
      return currentData.map((l) =>
        l.id === lecturerId
          ? {
              ...l,
              is_approved: false,
              lecturer_status: "rejected" as const,
              updated_at: new Date().toISOString(),
            }
          : l,
      );
    }, false);

    return responseData;
  };

  return {
    lecturers: filteredLecturers,
    allLecturers: data || [],
    isLoading,
    error,
    mutate,
    approveLecturer,
    rejectLecturer,
  };
}
