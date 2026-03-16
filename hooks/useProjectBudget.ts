"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface BudgetResult {
  totalBudget: number;
  totalSpent: number;
  remainingBudget: number;
  percentageRemaining: number;
  percentageSpent: number;
  isLoading: boolean;
  error: Error | null;
  status: "healthy" | "low" | "critical" | "depleted";
}

/**
 * Custom hook for calculating project budget progress with real-time updates.
 * Reads the `spent` column from the `projects` table (updated only when admin pays).
 */
export function useProjectBudget(
  projectId: string,
  totalBudget: number,
): BudgetResult {
  const [totalSpent, setTotalSpent] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const refreshBudget = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  // Real-time subscription on the projects table for spent changes
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`project_budget_${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "projects",
          filter: `id=eq.${projectId}`,
        },
        () => {
          refreshBudget();
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [projectId, refreshBudget]);

  useEffect(() => {
    let isMounted = true;

    async function fetchBudgetData() {
      if (!projectId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Read spent directly from the projects table
        const { data, error: queryError } = await supabase
          .from("projects")
          .select("spent")
          .eq("id", projectId)
          .single();

        if (queryError) {
          throw new Error(queryError.message);
        }

        if (isMounted) {
          setTotalSpent(parseFloat(data?.spent) || 0);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err
              : new Error("Failed to fetch budget data"),
          );
          setIsLoading(false);
        }
      }
    }

    fetchBudgetData();

    return () => {
      isMounted = false;
    };
  }, [projectId, refreshKey]);

  return useMemo(() => {
    const remainingBudget = Math.max(0, totalBudget - totalSpent);
    const percentageSpent =
      totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;
    const percentageRemaining = 100 - percentageSpent;

    let status: "healthy" | "low" | "critical" | "depleted";
    if (percentageRemaining <= 0) {
      status = "depleted";
    } else if (percentageRemaining <= 15) {
      status = "critical";
    } else if (percentageRemaining <= 35) {
      status = "low";
    } else {
      status = "healthy";
    }

    return {
      totalBudget,
      totalSpent,
      remainingBudget,
      percentageRemaining,
      percentageSpent,
      isLoading,
      error,
      status,
    };
  }, [totalBudget, totalSpent, isLoading, error]);
}
