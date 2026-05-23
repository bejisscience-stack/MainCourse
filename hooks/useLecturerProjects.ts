import useSWR from "swr";
import { supabase } from "@/lib/supabase";
import type { ActiveProject } from "@/hooks/useActiveProjects";

// Fetch all projects owned by the lecturer (any status — active,
// pending_payment, expired). RLS (projects_select_v2) limits the result to
// the caller's rows for non-active statuses; active projects are public-readable.
async function fetchLecturerProjects(userId: string): Promise<ActiveProject[]> {
  const { data, error } = await supabase
    .from("projects")
    .select(
      `
      id, message_id, channel_id, course_id, user_id, name, description,
      video_link, thumbnail_url, budget, min_views, max_views, platforms,
      start_date, end_date, created_at, updated_at, status,
      courses ( id, title, thumbnail_url, lecturer_id )
    `,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!data) return [];

  const projectIds = data.map((p: any) => p.id);
  const criteriaByProject = new Map<string, ActiveProject["criteria"]>();
  if (projectIds.length > 0) {
    const { data: crits } = await supabase
      .from("project_criteria")
      .select("id, project_id, criteria_text, rpm, display_order, platform")
      .in("project_id", projectIds)
      .order("display_order", { ascending: true });
    crits?.forEach((c: any) => {
      const list = criteriaByProject.get(c.project_id) || [];
      list.push({
        id: c.id,
        criteria_text: c.criteria_text,
        rpm: c.rpm,
        display_order: c.display_order,
        platform: c.platform,
      });
      criteriaByProject.set(c.project_id, list);
    });
  }

  return data.map((p: any) => {
    const course = p.courses ?? null;
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
      lecturer_id: p.user_id,
      lecturer_username: null,
      lecturer_full_name: null,
      criteria: criteriaByProject.get(p.id) || [],
    } as ActiveProject;
  });
}

export function useLecturerProjects(lecturerId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ActiveProject[]>(
    lecturerId ? ["lecturer-projects", lecturerId] : null,
    () =>
      lecturerId ? fetchLecturerProjects(lecturerId) : Promise.resolve([]),
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
      fallbackData: [],
    },
  );

  return {
    projects: Array.isArray(data) ? data : [],
    isLoading,
    error,
    mutate,
  };
}
