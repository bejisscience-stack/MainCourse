"use client";

import useSWR from "swr";
import { supabase } from "@/lib/supabase";
import type { SubmissionReviewSummary } from "@/hooks/useProjectSubmissions";

export interface MyProjectSubmission {
  id: string;
  video_url: string | null;
  message: string | null;
  platform_links: Record<string, string> | null;
  created_at: string;
  reviews: SubmissionReviewSummary[];
}

async function fetchMySubmissions(
  projectId: string,
  userId: string,
): Promise<MyProjectSubmission[]> {
  // Own rows only — RLS already permits reading them (and their reviews,
  // whatever the review status) for anyone who could submit.
  const { data, error } = await supabase
    .from("project_submissions")
    .select(
      "id, video_url, message, platform_links, created_at, submission_reviews(platform, status, payment_amount)",
    )
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[useMyProjectSubmissions] Error:", error);
    throw error;
  }

  return (data || []).map((s: any) => {
    const embedded = Array.isArray(s.submission_reviews)
      ? s.submission_reviews
      : s.submission_reviews
        ? [s.submission_reviews]
        : [];
    return {
      id: s.id,
      video_url: s.video_url,
      message: s.message,
      platform_links: s.platform_links ?? null,
      created_at: s.created_at,
      reviews: embedded.map((review: any) => ({
        platform: review.platform || "all",
        status: review.status,
        payment_amount: parseFloat(review.payment_amount || "0"),
      })),
    };
  });
}

/**
 * The current user's own submissions to a project, with review status.
 * Pass userId=null to disable (logged out, owner, lecturer).
 */
export function useMyProjectSubmissions(
  projectId: string | null | undefined,
  userId: string | null | undefined,
) {
  const { data, error, isLoading, mutate } = useSWR<MyProjectSubmission[]>(
    projectId && userId ? ["my-project-submissions", projectId, userId] : null,
    () => fetchMySubmissions(projectId!, userId!),
    {
      revalidateOnFocus: true,
      dedupingInterval: 15000,
      fallbackData: [],
    },
  );

  return {
    submissions: data || [],
    isLoading,
    error,
    mutate,
  };
}
