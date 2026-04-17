"use client";

import Link from "next/link";
import { useState } from "react";
import ProjectCard from "@/components/ProjectCard";
import ProjectDetailsModal from "@/components/ProjectDetailsModal";
import { useI18n } from "@/contexts/I18nContext";
import {
  useActiveProjects,
  type ActiveProject,
} from "@/hooks/useActiveProjects";

export default function LandingCourseShowcase() {
  const { t } = useI18n();
  const {
    projects,
    isLoading: projectsLoading,
    error: projectsError,
  } = useActiveProjects();
  const [selectedProject, setSelectedProject] = useState<ActiveProject | null>(
    null,
  );

  return (
    <section className="px-4 sm:px-6 lg:px-8 pb-20 md:pb-28">
      <div className="max-w-7xl mx-auto space-y-16">
        <div>
          <div className="flex items-end justify-between mb-5">
            <div>
              <h3 className="text-xl md:text-2xl font-bold text-charcoal-950 dark:text-white">
                {t("activeProjects.title")}
              </h3>
              <p className="text-sm text-charcoal-500 dark:text-gray-400 mt-1">
                {t("projectsPage.subtitle")}
              </p>
            </div>
            <Link
              href="/projects"
              className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500"
            >
              {t("nav.projects")}
            </Link>
          </div>

          {projectsLoading && projects.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
            </div>
          ) : projectsError ? (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-700 dark:text-red-400 px-6 py-4 rounded-2xl text-center shadow-soft">
              <p className="font-medium mb-1">
                {t("activeProjects.errorLoading")}
              </p>
              <p className="text-sm">
                {projectsError.message || t("activeProjects.errorMessage")}
              </p>
            </div>
          ) : projects.length > 0 ? (
            <div className="flex gap-5 overflow-x-auto pb-2 snap-x scrollbar-thin">
              {projects.slice(0, 8).map((project) => (
                <div
                  key={project.id}
                  className="min-w-[280px] max-w-[320px] snap-start flex-1"
                >
                  <ProjectCard
                    project={project}
                    onClick={() => setSelectedProject(project)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 bg-white/60 dark:bg-navy-800/60 border border-charcoal-100/50 dark:border-navy-700/50 rounded-2xl">
              <p className="text-charcoal-600 dark:text-gray-300">
                {t("projectsPage.noProjects")}
              </p>
            </div>
          )}
        </div>
      </div>

      <ProjectDetailsModal
        project={selectedProject}
        isOpen={!!selectedProject}
        onClose={() => setSelectedProject(null)}
      />
    </section>
  );
}
