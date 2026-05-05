import useSWR from "swr";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAdminRealtimeInvalidation } from "@/hooks/useAdminRealtimeInvalidation";

export interface StudentProjectAccess {
  id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  project_access_expires_at: string | null;
  created_at: string;
}

export interface StudentProjectAccessCounts {
  total: number;
  active: number;
  expired: number;
  never: number;
  expiringSoon: number;
}

interface FetchResult {
  students: StudentProjectAccess[];
  counts: StudentProjectAccessCounts;
}

const STUDENT_PROJECT_ACCESS_LIVE_TABLES = ["profiles"] as const;

const EMPTY_RESULT: FetchResult = {
  students: [],
  counts: { total: 0, active: 0, expired: 0, never: 0, expiringSoon: 0 },
};

async function fetchStudents(query: string): Promise<FetchResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const params = new URLSearchParams({ t: String(Date.now()) });
  if (query) params.set("q", query);

  const response = await fetch(
    `/api/admin/student-project-access?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Cache-Control": "no-cache",
      },
      cache: "no-store",
      next: { revalidate: 0 },
    },
  );

  const responseClone = response.clone();
  if (!response.ok) {
    let errorMessage = `Failed to fetch student project access (${response.status})`;
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
  return {
    students: data.students || [],
    counts: data.counts || EMPTY_RESULT.counts,
  };
}

export function useAdminStudentProjectAccess() {
  const [query, setQuery] = useState("");

  const { data, error, isLoading, mutate } = useSWR<FetchResult>(
    ["admin-student-project-access", query],
    ([, q]) => fetchStudents(q as string),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
      refreshInterval: 15000,
      keepPreviousData: true,
      fallbackData: EMPTY_RESULT,
    },
  );

  useAdminRealtimeInvalidation({
    channelName: "admin-student-project-access-live",
    tables: STUDENT_PROJECT_ACCESS_LIVE_TABLES,
    onChange: () => {
      void mutate();
    },
  });

  async function postPatch(
    studentId: string,
    body: Record<string, unknown>,
  ): Promise<StudentProjectAccess> {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) throw new Error("Not authenticated");

    const response = await fetch(
      `/api/admin/student-project-access/${studentId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
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
      throw new Error(responseData.error || "Request failed");
    }
    return responseData.student as StudentProjectAccess;
  }

  function applyOptimistic(
    studentId: string,
    nextExpiresAt: string | null,
  ): void {
    void mutate((current) => {
      if (!current) return current;
      const nextStudents = current.students.map((s) =>
        s.id === studentId
          ? { ...s, project_access_expires_at: nextExpiresAt }
          : s,
      );
      return { students: nextStudents, counts: current.counts };
    }, false);
  }

  const setAccess = async (
    studentId: string,
    expiresAt: string | null,
    reason?: string,
  ) => {
    applyOptimistic(studentId, expiresAt);
    return postPatch(studentId, { expires_at: expiresAt, reason });
  };

  const extendAccess = async (
    studentId: string,
    days: number,
    reason?: string,
  ) => {
    return postPatch(studentId, { extend_days: days, reason });
  };

  return {
    students: data?.students || [],
    counts: data?.counts || EMPTY_RESULT.counts,
    isLoading,
    error,
    mutate,
    query,
    setQuery,
    setAccess,
    extendAccess,
  };
}
