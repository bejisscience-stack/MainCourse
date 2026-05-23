"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import Navigation from "@/components/Navigation";
import BackgroundShapes from "@/components/BackgroundShapes";
import ProjectCard from "@/components/ProjectCard";
import LecturerProjectCreationModal from "@/components/LecturerProjectCreationModal";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/hooks/useUser";
import { useI18n } from "@/contexts/I18nContext";
import type { ActiveProject } from "@/hooks/useActiveProjects";

// Fetch projects owned by the current lecturer (any status — active,
// pending_payment, expired). RLS limits the result to the caller's rows
// when status filters don't apply (projects_select_v2: owner sees all own).
async function fetchOwnProjects(userId: string): Promise<ActiveProject[]> {
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
  let criteriaByProject = new Map<string, ActiveProject["criteria"]>();
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

export default function LecturerProjectsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const { user, profile, isLoading: userLoading } = useUser();

  // Mirrors app/lecturer/dashboard route guard. useUser's Profile select
  // doesn't expose lecturer_status; the API + RLS enforce the stricter check
  // on the server side, so is_approved is sufficient for UI gating here.
  const isApprovedLecturer =
    profile?.role === "lecturer" && profile?.is_approved === true;

  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (userLoading) return;
    if (!user) router.push("/login");
    else if (!isApprovedLecturer) router.push("/");
  }, [user, userLoading, isApprovedLecturer, router]);

  useEffect(() => {
    if (
      searchParams.get("create") === "true" &&
      !userLoading &&
      user &&
      isApprovedLecturer
    ) {
      setCreateOpen(true);
      router.replace("/lecturer/projects", { scroll: false });
    }
  }, [searchParams, userLoading, user, isApprovedLecturer, router]);

  const swrKey =
    user && isApprovedLecturer ? ["lecturer-projects", user.id] : null;
  const {
    data: projects,
    isLoading,
    mutate,
  } = useSWR<ActiveProject[]>(swrKey, () => fetchOwnProjects(user!.id), {
    revalidateOnFocus: false,
    fallbackData: [],
  });

  const handleCreated = useCallback(() => {
    mutate();
  }, [mutate]);

  const safeProjects = useMemo(() => projects ?? [], [projects]);

  if (userLoading || !user || !isApprovedLecturer) {
    return (
      <div className="min-h-screen bg-white dark:bg-navy-950">
        <BackgroundShapes />
        <Navigation />
        <div className="pt-24 text-center text-charcoal-500 dark:text-gray-400">
          {t("common.loading") || "Loading..."}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-navy-950">
      <BackgroundShapes />
      <Navigation />

      <main className="pt-24 pb-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-charcoal-950 dark:text-white">
              {t("lecturerProjects.pageTitle") || "My Projects"}
            </h1>
            <p className="mt-1 text-sm text-charcoal-600 dark:text-gray-400">
              {t("lecturerProjects.pageSubtitle") ||
                "Create and manage projects independently of any course."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-soft"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            {t("lecturerProjects.createCta") || "Create Project"}
          </button>
        </div>

        {isLoading ? (
          <div className="text-center text-charcoal-500 dark:text-gray-400 py-16">
            {t("common.loading") || "Loading..."}
          </div>
        ) : safeProjects.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-charcoal-200 dark:border-navy-700 rounded-2xl">
            <p className="text-charcoal-600 dark:text-gray-400">
              {t("lecturerProjects.emptyState") ||
                "You haven't created any projects yet."}
            </p>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium"
            >
              {t("lecturerProjects.createFirst") || "Create your first project"}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {safeProjects.map((p) => (
              <ProjectCard key={p.id} project={p} href={`/projects/${p.id}`} />
            ))}
          </div>
        )}
      </main>

      <LecturerProjectCreationModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
