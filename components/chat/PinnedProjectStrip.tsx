"use client";

import { useMemo } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { useActiveProjects } from "@/hooks/useActiveProjects";

interface PinnedProjectStripProps {
  courseId: string | null;
  onOpenProject?: (projectId: string) => void;
}

export default function PinnedProjectStrip({
  courseId,
  onOpenProject,
}: PinnedProjectStripProps) {
  const { t } = useI18n();
  const { projects } = useActiveProjects();

  const project = useMemo(() => {
    if (!courseId || !projects?.length) return null;
    return projects.find((p) => p.course_id === courseId) || null;
  }, [courseId, projects]);

  const daysLeft = useMemo(() => {
    if (!project?.end_date) return null;
    const end = new Date(project.end_date);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / 86400000);
    return diff > 0 ? diff : null;
  }, [project]);

  if (!project || daysLeft == null) return null;

  return (
    <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-navy-900/50 px-3.5 py-2.5 shadow-soft">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/15 text-amber-200">
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 2s5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3-1-3 1-7 1-9zM7 17a5 5 0 0 0 10 0"
          />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-amber-300/90">
          {t("chat.activeProject")}
        </div>
        <div className="text-sm font-semibold text-gray-100 mt-0.5 truncate">
          {project.name}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-200">
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z"
            />
          </svg>
          {t("chat.daysLeft", { days: daysLeft })}
        </span>
        {onOpenProject && (
          <button
            onClick={() => onOpenProject(project.id)}
            className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-navy-800/60 bg-navy-900/50 px-3 py-1.5 text-[12px] font-medium text-gray-100 transition-colors hover:bg-navy-800/70"
          >
            {t("chat.uploadAction")}
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 6l6 6-6 6"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
