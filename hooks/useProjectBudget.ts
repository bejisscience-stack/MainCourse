'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRealtimeSubmissionReviews } from './useRealtimeProjects';

export interface BudgetResult {
  totalBudget: number;
  totalSpent: number;
  remainingBudget: number;
  percentageRemaining: number;
  percentageSpent: number;
  isLoading: boolean;
  error: Error | null;
  status: 'healthy' | 'low' | 'critical' | 'depleted';
}

/**
 * Custom hook for calculating project budget progress with real-time updates
 * @param projectId - The project ID to fetch budget data for
 * @param totalBudget - The total budget amount for the project
 */
export function useProjectBudget(
  projectId: string,
  totalBudget: number
): BudgetResult {
  const [totalSpent, setTotalSpent] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Callback to trigger a refresh
  const refreshBudget = useCallback(() => {
    console.log('[useProjectBudget] Real-time update triggered, refreshing budget data');
    setRefreshKey(prev => prev + 1);
  }, []);

  // Set up real-time subscription for submission_reviews
  useRealtimeSubmissionReviews({
    projectId,
    enabled: !!projectId,
    onChange: refreshBudget,
  });

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

        // Query submission_reviews to get total payment_amount for this project
        const { data, error: queryError } = await supabase
          .from('submission_reviews')
          .select('payment_amount')
          .eq('project_id', projectId)
          .eq('status', 'accepted');

        if (queryError) {
          throw new Error(queryError.message);
        }

        if (isMounted) {
          // Sum up all payment amounts
          const spent = data?.reduce((sum, review) => {
            return sum + (parseFloat(review.payment_amount) || 0);
          }, 0) || 0;

          setTotalSpent(spent);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Failed to fetch budget data'));
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
    const percentageSpent = totalBudget > 0
      ? Math.min(100, (totalSpent / totalBudget) * 100)
      : 0;
    const percentageRemaining = 100 - percentageSpent;

    // Determine budget status based on remaining percentage
    let status: 'healthy' | 'low' | 'critical' | 'depleted';
    if (percentageRemaining <= 0) {
      status = 'depleted';
    } else if (percentageRemaining <= 15) {
      status = 'critical';
    } else if (percentageRemaining <= 35) {
      status = 'low';
    } else {
      status = 'healthy';
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
