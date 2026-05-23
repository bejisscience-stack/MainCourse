"use client";

import { memo, useMemo } from "react";
import Link from "next/link";
import { useI18n } from "@/contexts/I18nContext";
import { formatPriceInGel } from "@/lib/currency";
import type { ActiveProject } from "@/hooks/useActiveProjects";
import { useProjectCountdown } from "@/hooks/useProjectCountdown";

interface ProjectCampaignCardProps {
  project: ActiveProject;
}

function PlatformGlyph({ platform }: { platform: string }) {
  const key = platform.toLowerCase();
  if (key === "youtube") {
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    );
  }
  if (key === "instagram") {
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    );
  }
  if (key === "tiktok") {
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    );
  }
  if (key === "facebook") {
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    );
  }
  return <span className="text-sm">•</span>;
}

function ProjectCampaignCard({ project }: ProjectCampaignCardProps) {
  const { t } = useI18n();
  const countdown = useProjectCountdown(project.start_date, project.end_date);
  const isExpired = countdown.isExpired;
  const isEndingSoon =
    !isExpired && countdown.timeRemaining.days <= 3 && countdown.isStarted;

  const formattedBudget = useMemo(() => {
    const f = formatPriceInGel(project.budget);
    return f.replace(/\.00$/, "").replace(/,00$/, "");
  }, [project.budget]);

  const statusPill = useMemo(() => {
    if (isExpired) {
      return {
        label: t("projectsPage.statusExpired") || "Expired",
        cls: "bg-charcoal-200 text-charcoal-700 dark:bg-navy-700/80 dark:text-gray-300",
        dot: "bg-charcoal-500 dark:bg-gray-400",
      };
    }
    if (isEndingSoon) {
      return {
        label: t("projectsPage.statusEndingSoon") || "Ending soon",
        cls: "bg-amber-500/20 text-amber-100 dark:bg-amber-500/20 dark:text-amber-300",
        dot: "bg-amber-400",
      };
    }
    return {
      label: t("projectsPage.statusActive") || "Active",
      cls: "bg-emerald-500/25 text-emerald-100 dark:bg-emerald-500/25 dark:text-emerald-300",
      dot: "bg-emerald-400",
    };
  }, [isExpired, isEndingSoon, t]);

  const primaryPlatform = project.platforms?.[0];
  const extraPlatformCount = Math.max(0, (project.platforms?.length || 0) - 1);

  const cardInner = (
    <div
      className={`group relative h-full overflow-hidden rounded-3xl shadow-soft transition-all duration-300 border border-charcoal-100/60 dark:border-navy-700/60 ${
        isExpired
          ? "opacity-60 grayscale"
          : "hover:shadow-2xl hover:shadow-emerald-500/10 dark:hover:shadow-emerald-500/20 hover:-translate-y-1"
      }`}
    >
      {/* Image area (square) */}
      <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-charcoal-100 via-white to-emerald-50 dark:from-navy-800 dark:via-navy-900 dark:to-navy-800">
        {project.course_thumbnail_url ? (
          <img
            src={project.course_thumbnail_url}
            alt={project.course_title ?? ""}
            className={`absolute inset-0 h-full w-full object-cover transition-transform duration-500 ${
              isExpired ? "" : "group-hover:scale-105"
            }`}
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              className="w-16 h-16 text-emerald-500/40 dark:text-emerald-400/40"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
        )}

        {/* Top dark gradient for legibility */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-2/3 bg-gradient-to-b from-charcoal-950/85 via-charcoal-950/40 to-transparent dark:from-navy-950/90 dark:via-navy-950/45" />

        {/* Bottom dark gradient for budget strip */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-charcoal-950/90 via-charcoal-950/55 to-transparent dark:from-navy-950/95 dark:via-navy-950/60" />

        {/* Title block — top-left */}
        <div className="absolute inset-x-0 top-0 p-5">
          <h3 className="text-white text-xl md:text-2xl font-bold leading-tight tracking-tight line-clamp-2 drop-shadow-md">
            {project.name}
          </h3>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide backdrop-blur-sm ${statusPill.cls}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusPill.dot}`} />
              {statusPill.label}
            </span>
            {countdown.formattedTime && !isExpired && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/15 text-white backdrop-blur-sm border border-white/15">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {countdown.formattedTime}
              </span>
            )}
          </div>
        </div>

        {/* Bottom info bar — budget + course + platform */}
        <div className="absolute inset-x-0 bottom-0 p-5">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-medium uppercase tracking-wider text-white/70">
                {t("activeProjects.budget") || "Budget"}
              </div>
              <div className="text-white text-2xl md:text-[28px] font-bold leading-none mt-1">
                {formattedBudget}
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5 max-w-full">
                <svg
                  className="w-3 h-3 text-white/80 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
                <span className="text-white/85 text-xs truncate">
                  {project.course_title}
                </span>
              </div>
            </div>

            {primaryPlatform && (
              <div className="flex-shrink-0 flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-xl px-2.5 py-2 border border-white/15">
                <span className="text-white/90 flex items-center">
                  <PlatformGlyph platform={primaryPlatform} />
                </span>
                {extraPlatformCount > 0 && (
                  <span className="text-white/90 text-[11px] font-semibold">
                    +{extraPlatformCount}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (isExpired) {
    return <div className="h-full cursor-not-allowed">{cardInner}</div>;
  }

  return (
    <Link
      href={`/projects/${project.id}`}
      className="block h-full rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-navy-950"
    >
      {cardInner}
    </Link>
  );
}

export default memo(ProjectCampaignCard);
