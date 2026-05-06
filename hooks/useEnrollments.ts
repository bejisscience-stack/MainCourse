import { useMemo, useCallback, useEffect } from "react";
import useSWR from "swr";
import { supabase } from "@/lib/supabase";
import { useRealtimeReconnect } from "./useRealtimeReconnect";

export interface EnrollmentInfo {
  expiresAt: string | null;
  isActive: boolean;
  isExpired: boolean;
  daysRemaining: number | null;
}

interface EnrollmentData {
  course_id: string;
  expires_at: string | null;
}

async function fetchEnrollments(
  userId: string,
): Promise<Map<string, EnrollmentInfo>> {
  const { data, error } = await supabase
    .from("enrollments")
    .select("course_id, expires_at")
    .eq("user_id", userId);

  if (error) throw error;

  const enrollmentsMap = new Map<string, EnrollmentInfo>();
  const now = new Date();

  data?.forEach((e: EnrollmentData) => {
    const expiresAt = e.expires_at ? new Date(e.expires_at) : null;
    const isExpired = expiresAt ? expiresAt < now : false;
    let daysRemaining: number | null = null;

    if (expiresAt) {
      const diffMs = expiresAt.getTime() - now.getTime();
      daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (daysRemaining < 0) daysRemaining = 0;
    }

    enrollmentsMap.set(e.course_id, {
      expiresAt: e.expires_at,
      isActive: !isExpired,
      isExpired,
      daysRemaining,
    });
  });

  return enrollmentsMap;
}

export function useEnrollments(userId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<
    Map<string, EnrollmentInfo>
  >(
    userId ? ["enrollments", userId] : null,
    () => (userId ? fetchEnrollments(userId) : Promise.resolve(new Map())),
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      fallbackData: new Map(),
    },
  );

  // Live updates: any change to this user's enrollments triggers a refetch.
  // The `enrollments` table is already in supabase_realtime (migration 208).
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`enrollments:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "enrollments",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          mutate();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, mutate]);

  // Catch up if events are missed during a websocket drop.
  useRealtimeReconnect(() => {
    if (userId) mutate();
  });

  const enrollments = data || new Map<string, EnrollmentInfo>();

  // Backward compatibility: derive Set from Map keys
  // IMPORTANT: Memoize to prevent infinite re-renders when used in dependency arrays
  const enrolledCourseIds = useMemo(() => {
    return new Set(enrollments.keys());
  }, [enrollments]);

  // Helper function to check if enrollment is active (not expired)
  // Memoized to prevent unnecessary re-renders
  const isEnrollmentActive = useCallback(
    (courseId: string): boolean => {
      const info = enrollments.get(courseId);
      return info?.isActive ?? false;
    },
    [enrollments],
  );

  // Helper function to get full enrollment info for a course
  // Memoized to prevent unnecessary re-renders
  const getEnrollmentInfo = useCallback(
    (courseId: string): EnrollmentInfo | null => {
      return enrollments.get(courseId) || null;
    },
    [enrollments],
  );

  return {
    enrollments,
    enrolledCourseIds, // Backward compatible
    isLoading,
    error,
    mutate,
    isEnrollmentActive,
    getEnrollmentInfo,
  };
}
