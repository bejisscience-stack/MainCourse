"use client";

import { useEffect } from "react";
import Navigation from "@/components/Navigation";
import ProjectCampaignCard from "@/components/ProjectCampaignCard";
import { useActiveProjects } from "@/hooks/useActiveProjects";
import { useI18n } from "@/contexts/I18nContext";

export default function ProjectsPage() {
  const { t } = useI18n();
  const { projects, isLoading, error } = useActiveProjects();

  useEffect(() => {
    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      window.fbq("track", "ViewContent", {
        content_type: "product_group",
        content_name: "Projects",
      });
    }
  }, []);

  return (
    <main className="relative bg-gradient-to-b from-[#fafafa] to-white dark:from-navy-950 dark:to-navy-900 overflow-hidden min-h-screen">
      {/* Base gradient layer */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#fafafa] via-white to-[#fafafa] dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 pointer-events-none" />

      <Navigation />
      <div className="relative z-10 pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-bold text-charcoal-950 dark:text-white mb-4 tracking-tight">
              {t("projectsPage.title")}
            </h1>
            <p className="text-lg text-charcoal-600 dark:text-gray-400 max-w-2xl mx-auto">
              {t("projectsPage.subtitle")}
            </p>
          </div>

          {/* Projects Count Badge */}
          {!isLoading && !error && projects.length > 0 && (
            <div className="flex justify-center mb-10">
              <span className="inline-flex items-center px-4 py-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm font-medium rounded-full">
                {projects.length === 1
                  ? t("projectsPage.projectCount", { count: projects.length })
                  : t("projectsPage.projectsCount", { count: projects.length })}
              </span>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-3xl overflow-hidden border border-charcoal-100/60 dark:border-navy-700/60 bg-gradient-to-br from-white via-charcoal-50 to-white dark:from-navy-800 dark:via-navy-900 dark:to-navy-800 animate-pulse"
                />
              ))}
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="text-center py-16">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-6 py-4 rounded-lg inline-block max-w-md">
                <p className="font-semibold">
                  {t("activeProjects.errorLoading")}
                </p>
                <p className="text-sm mt-1">
                  {t("activeProjects.errorMessage")}
                </p>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && projects.length === 0 && (
            <div className="text-center py-16 bg-white/50 dark:bg-navy-800/50 rounded-3xl border border-charcoal-100/50 dark:border-navy-700/50">
              <div className="w-16 h-16 bg-charcoal-100 dark:bg-navy-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-charcoal-400 dark:text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <p className="text-charcoal-600 dark:text-gray-400 text-lg mb-2">
                {t("projectsPage.noProjects")}
              </p>
              <p className="text-charcoal-500 dark:text-gray-500 text-sm">
                {t("projectsPage.noProjectsDescription")}
              </p>
            </div>
          )}

          {/* Projects Grid */}
          {!isLoading && !error && projects.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {projects.map((project) => (
                <ProjectCampaignCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
