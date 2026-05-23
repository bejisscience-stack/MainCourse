"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Navigation from "@/components/Navigation";
import BackgroundShapes from "@/components/BackgroundShapes";
import ProjectCard from "@/components/ProjectCard";
import LecturerProjectCreationModal from "@/components/LecturerProjectCreationModal";
import { useUser } from "@/hooks/useUser";
import { useI18n } from "@/contexts/I18nContext";
import { useLecturerProjects } from "@/hooks/useLecturerProjects";

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

  const { projects, isLoading, mutate } = useLecturerProjects(
    user && isApprovedLecturer ? user.id : null,
  );

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
