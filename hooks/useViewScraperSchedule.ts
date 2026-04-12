"use client";

import useSWR from "swr";
import { useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface ViewScraperSchedule {
  jobid: number | null;
  jobname: string;
  schedule: string | null;
  active: boolean;
}

export interface ViewScraperScheduleResult {
  schedule: ViewScraperSchedule | null;
  isLoading: boolean;
  error: string | null;
  updateSchedule: (cron: string) => Promise<boolean>;
  toggleActive: (active: boolean) => Promise<boolean>;
}

export function useViewScraperSchedule(): ViewScraperScheduleResult {
  const { data, isLoading, error, mutate } = useSWR(
    "/api/admin/view-scraper/schedule",
    async (url) => {
      let {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        const {
          data: { session: refreshed },
        } = await supabase.auth.refreshSession();
        session = refreshed;
      }
      if (!session?.access_token) throw new Error("Not authenticated");
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to fetch schedule");
      }
      return response.json();
    },
    { revalidateOnFocus: false, dedupingInterval: 30000 },
  );

  const schedule: ViewScraperSchedule | null = data?.schedule || null;

  const updateSchedule = useCallback(
    async (cron: string): Promise<boolean> => {
      try {
        let {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          const {
            data: { session: refreshed },
          } = await supabase.auth.refreshSession();
          session = refreshed;
        }
        if (!session?.access_token) return false;
        const response = await fetch("/api/admin/view-scraper/schedule", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ schedule: cron }),
        });
        if (response.ok) {
          const result = await response.json();
          mutate({ schedule: result.schedule }, false);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [mutate],
  );

  const toggleActive = useCallback(
    async (active: boolean): Promise<boolean> => {
      try {
        let {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          const {
            data: { session: refreshed },
          } = await supabase.auth.refreshSession();
          session = refreshed;
        }
        if (!session?.access_token) return false;
        const response = await fetch("/api/admin/view-scraper/schedule", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ active }),
        });
        if (response.ok) {
          const result = await response.json();
          mutate({ schedule: result.schedule }, false);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [mutate],
  );

  return {
    schedule,
    isLoading,
    error: error?.message || null,
    updateSchedule,
    toggleActive,
  };
}
