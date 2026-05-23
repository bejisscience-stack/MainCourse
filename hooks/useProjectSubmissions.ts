"use client";

import { useEffect, useCallback } from "react";
import useSWR from "swr";
import { supabase } from "@/lib/supabase";

export interface ProjectSubmission {
  id: string;
  project_id: string;
  user_id: string;
  video_url: string | null;
  message: string | null;
  created_at: string;
  submitter_username: string | null;
  submitter_full_name: string | null;
  submitter_avatar_url: string | null;
}

async function fetchProjectSubmissions(
  projectId: string,
  limit: number,
): Promise<ProjectSubmission[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // RLS restricts this query to enrolled users / lecturer; unauthenticated
  // callers get nothing back, which is fine — we render an empty state.
  const { data: submissions, error } = await supabase
    .from("project_submissions")
    .select("id, project_id, user_id, video_url, message, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[useProjectSubmissions] Error:", error);
    throw error;
  }

  if (!submissions || submissions.length === 0) return [];

  let profileMap = new Map<string, any>();
  if (session) {
    const userIds = [...new Set(submissions.map((s: any) => s.user_id))];
    const { data: profiles } = await supabase.rpc("get_safe_profiles", {
      user_ids: userIds,
    });
    profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);
  }

  return submissions.map((s: any) => {
    const profile = profileMap.get(s.user_id);
    return {
      id: s.id,
      project_id: s.project_id,
      user_id: s.user_id,
      video_url: s.video_url,
      message: s.message,
      created_at: s.created_at,
      submitter_username: profile?.username || null,
      submitter_full_name: profile?.full_name || null,
      submitter_avatar_url: profile?.avatar_url || null,
    };
  });
}

export function useProjectSubmissions(
  projectId: string | null | undefined,
  limit: number = 10,
) {
  const { data, error, isLoading, mutate } = useSWR<ProjectSubmission[]>(
    projectId ? ["project-submissions", projectId, limit] : null,
    () => fetchProjectSubmissions(projectId!, limit),
    {
      revalidateOnFocus: false,
      dedupingInterval: 15000,
      fallbackData: [],
    },
  );

  const refresh = useCallback(() => {
    mutate();
  }, [mutate]);

  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`project_submissions:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_submissions",
          filter: `project_id=eq.${projectId}`,
        },
        () => refresh(),
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [projectId, refresh]);

  return {
    submissions: data || [],
    isLoading,
    error,
    mutate,
  };
}
