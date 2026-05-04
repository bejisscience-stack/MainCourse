import useSWR from "swr";
import { supabase } from "@/lib/supabase";
import { useAdminRealtimeInvalidation } from "@/hooks/useAdminRealtimeInvalidation";

export interface FreeProjectLecturer {
  id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
  can_create_free_projects: boolean;
  lecturer_status: "pending" | "approved" | "rejected" | null;
  created_at: string;
  updated_at: string;
}

const FREE_PROJECT_LECTURER_LIVE_TABLES = ["profiles"] as const;

async function fetchFreeProjectLecturers(): Promise<FreeProjectLecturer[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) throw new Error("Not authenticated");

  const url = `/api/admin/free-project-lecturers?t=${Date.now()}`;
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
    let errorMessage = `Failed to fetch free-project lecturers (${response.status})`;
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

export function useAdminFreeProjectLecturers() {
  const { data, error, isLoading, mutate } = useSWR<FreeProjectLecturer[]>(
    "admin-free-project-lecturers",
    fetchFreeProjectLecturers,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
      refreshInterval: 15000,
      fallbackData: [],
    },
  );

  useAdminRealtimeInvalidation({
    channelName: "admin-free-project-lecturers-live",
    tables: FREE_PROJECT_LECTURER_LIVE_TABLES,
    onChange: () => {
      void mutate();
    },
  });

  const setExempt = async (lecturerId: string, allowed: boolean) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) throw new Error("Not authenticated");

    const response = await fetch(
      `/api/admin/free-project-lecturers/${lecturerId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ allowed }),
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
      throw new Error(
        responseData.error ||
          (allowed
            ? "Failed to grant free-project access"
            : "Failed to revoke free-project access"),
      );
    }

    // Optimistic update — refreshInterval (15s) confirms from DB.
    await mutate((currentData) => {
      if (!currentData) return currentData;
      return currentData.map((l) =>
        l.id === lecturerId
          ? {
              ...l,
              can_create_free_projects: allowed,
              updated_at: new Date().toISOString(),
            }
          : l,
      );
    }, false);

    return responseData;
  };

  return {
    lecturers: data || [],
    isLoading,
    error,
    mutate,
    setExempt,
  };
}
