"use client";

import useSWR, { mutate } from "swr";
import { useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useEnrollments } from "@/hooks/useEnrollments";

export interface ProjectSubscription {
  id: string;
  user_id: string;
  starts_at: string | null;
  expires_at: string | null;
  price: number;
  status: "pending" | "active" | "expired" | "rejected";
  payment_method: string | null;
  approved_at: string | null;
}

export interface ProjectAccessData {
  accessTier: "subscription" | "new_user" | "none";
  hasActiveSubscription: boolean;
  isNewUser: boolean;
  enrolledCourseIds: Set<string>;
  canSubmitToProject: (courseId: string) => boolean;
  subscription: ProjectSubscription | null;
  isLoading: boolean;
}

async function getAuthToken(): Promise<string | null> {
  let {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    const {
      data: { session: refreshed },
    } = await supabase.auth.refreshSession();
    session = refreshed;
  }
  return session?.access_token || null;
}

/**
 * Three-tier project access model:
 * 1. Active project subscription → all projects (1 month)
 * 2. Course enrollment → only that course's projects (lifetime)
 * 3. New user (< 30 days) → all projects
 */
export function useProjectAccess(userId?: string): ProjectAccessData {
  // Fetch profile (project_access_expires_at + created_at)
  const { data: profileData, isLoading: profileLoading } = useSWR(
    userId ? `/api/profile?userId=${userId}` : null,
    async (url) => {
      const token = await getAuthToken();
      if (!token) return null;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return null;
      return response.json();
    },
    { revalidateOnFocus: true, dedupingInterval: 5000 },
  );

  // Fetch user's latest subscription
  const subKey = userId ? "/api/project-subscriptions" : null;
  const { data: subscriptionData, isLoading: subLoading } = useSWR(
    subKey,
    async (url) => {
      const token = await getAuthToken();
      if (!token) return null;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return null;
      const result = await response.json();
      return result.subscriptions?.[0] || null;
    },
    { revalidateOnFocus: true, dedupingInterval: 5000 },
  );

  // Fetch enrollments
  const { enrolledCourseIds, isLoading: enrollmentsLoading } =
    useEnrollments(userId || null);

  // Subscribe to realtime updates on project_subscriptions
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`project_subscriptions:user_id=eq.${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_subscriptions",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          mutate("/api/project-subscriptions");
          mutate(`/api/profile?userId=${userId}`);
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [userId]);

  const now = new Date();

  const hasActiveSubscription =
    subscriptionData != null &&
    subscriptionData.status === "active" &&
    subscriptionData.expires_at != null &&
    new Date(subscriptionData.expires_at) > now;

  const isNewUser = useMemo(() => {
    const createdAt = profileData?.profile?.created_at;
    if (!createdAt) return false;
    const registeredDate = new Date(createdAt);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return registeredDate > thirtyDaysAgo;
  }, [profileData?.profile?.created_at]);

  const accessTier = useMemo(() => {
    if (hasActiveSubscription) return "subscription" as const;
    if (isNewUser) return "new_user" as const;
    return "none" as const;
  }, [hasActiveSubscription, isNewUser]);

  const canSubmitToProject = useCallback(
    (courseId: string): boolean => {
      if (hasActiveSubscription) return true;
      if (isNewUser) return true;
      return enrolledCourseIds.has(courseId);
    },
    [hasActiveSubscription, isNewUser, enrolledCourseIds],
  );

  return {
    accessTier,
    hasActiveSubscription,
    isNewUser,
    enrolledCourseIds,
    canSubmitToProject,
    subscription: subscriptionData,
    isLoading: profileLoading || subLoading || enrollmentsLoading,
  };
}
