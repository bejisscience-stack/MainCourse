"use client";

import useSWR, { mutate } from "swr";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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
  hasInitialAccess: boolean;
  hasActiveSubscription: boolean;
  hasProjectAccess: boolean;
  subscription: ProjectSubscription | null;
  isLoading: boolean;
  projectAccessExpiresAt: string | null;
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
 * Determine if user has active project access via:
 * 1. Initial 1-month grant from first course approval
 * 2. Active project subscription
 */
export function useProjectAccess(userId?: string): ProjectAccessData {
  const [projectAccessExpiresAt, setProjectAccessExpiresAt] = useState<
    string | null
  >(null);

  // Fetch profile project_access_expires_at
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
          // Revalidate SWR caches instead of full page reload
          mutate("/api/project-subscriptions");
          mutate(`/api/profile?userId=${userId}`);
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [userId]);

  // Update local state from profile data
  useEffect(() => {
    if (profileData?.profile?.project_access_expires_at) {
      setProjectAccessExpiresAt(profileData.profile.project_access_expires_at);
    }
  }, [profileData]);

  const now = new Date();

  const hasInitialAccess =
    projectAccessExpiresAt != null && new Date(projectAccessExpiresAt) > now;

  const hasActiveSubscription =
    subscriptionData != null &&
    subscriptionData.status === "active" &&
    subscriptionData.expires_at != null &&
    new Date(subscriptionData.expires_at) > now;

  return {
    hasInitialAccess,
    hasActiveSubscription,
    hasProjectAccess: hasInitialAccess || hasActiveSubscription,
    subscription: subscriptionData,
    isLoading: profileLoading || subLoading,
    projectAccessExpiresAt,
  };
}
