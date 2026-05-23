"use client";

import { useEffect, useCallback } from "react";
import useSWR from "swr";
import { supabase } from "@/lib/supabase";
import type { ActiveProject } from "./useActiveProjects";

async function fetchProject(id: string): Promise<ActiveProject | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { data: project, error } = await supabase
    .from("projects")
    .select(
      `
      id, message_id, channel_id, course_id, user_id, name, description, video_link, thumbnail_url, budget, min_views, max_views, platforms, start_date, end_date, created_at, updated_at, status,
      courses ( id, title, thumbnail_url, lecturer_id )
    `,
    )
    .eq("id", id)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.error("[useProjectById] Error:", error);
    throw error;
  }
  if (!project) return null;

  const p: any = project;
  const course = p.courses ?? null;
  const lecturerId = p.user_id ?? course?.lecturer_id;

  let profile: any = null;
  if (session && lecturerId) {
    const { data: profiles } = await supabase.rpc("get_safe_profiles", {
      user_ids: [lecturerId],
    });
    profile = profiles?.[0] || null;
  }

  const { data: criteria } = await supabase
    .from("project_criteria")
    .select("id, criteria_text, rpm, display_order, platform")
    .eq("project_id", p.id)
    .order("display_order", { ascending: true });

  const { data: resources } = await supabase
    .from("project_resources")
    .select("id, resource_type, title, url, display_order")
    .eq("project_id", p.id)
    .order("display_order", { ascending: true });

  return {
    id: p.id,
    message_id: p.message_id,
    channel_id: p.channel_id,
    course_id: p.course_id,
    user_id: p.user_id,
    name: p.name,
    description: p.description,
    video_link: p.video_link,
    budget: parseFloat(p.budget),
    min_views: p.min_views,
    max_views: p.max_views,
    platforms: p.platforms,
    start_date: p.start_date,
    end_date: p.end_date,
    created_at: p.created_at,
    updated_at: p.updated_at,
    course_title: course?.title ?? null,
    course_thumbnail_url: p.thumbnail_url ?? course?.thumbnail_url ?? null,
    lecturer_id: lecturerId,
    lecturer_username: profile?.username || null,
    lecturer_full_name: profile?.full_name || null,
    criteria: (criteria || []).map((c: any) => ({
      id: c.id,
      criteria_text: c.criteria_text,
      rpm: c.rpm,
      display_order: c.display_order,
      platform: c.platform,
    })),
    resources: (resources || []).map((r: any) => ({
      id: r.id,
      resource_type: r.resource_type,
      title: r.title,
      url: r.url,
      display_order: r.display_order,
    })),
  };
}

export function useProjectById(id: string | null | undefined) {
  const { data, error, isLoading, mutate } = useSWR<ActiveProject | null>(
    id ? ["project-by-id", id] : null,
    () => fetchProject(id!),
    {
      revalidateOnFocus: false,
      dedupingInterval: 15000,
    },
  );

  const refresh = useCallback(() => mutate(), [mutate]);

  useEffect(() => {
    if (!id) return;
    const chProject = supabase
      .channel(`project_detail:${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "projects",
          filter: `id=eq.${id}`,
        },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_criteria",
          filter: `project_id=eq.${id}`,
        },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_resources",
          filter: `project_id=eq.${id}`,
        },
        () => refresh(),
      )
      .subscribe();

    return () => {
      chProject.unsubscribe();
    };
  }, [id, refresh]);

  return {
    project: data || null,
    isLoading,
    error,
    mutate,
  };
}
