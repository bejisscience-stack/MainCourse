"use client";

import { useMemo, type ReactNode } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { formatPriceInGel } from "@/lib/currency";
import type { ProjectCriteria } from "@/hooks/useActiveProjects";

interface CriteriaGridProps {
  criteria: ProjectCriteria[];
}

const PLATFORM_ORDER = ["youtube", "instagram", "tiktok", "facebook"];

type PlatformVisual = {
  icon: ReactNode;
  chipBg: string;
  chipText: string;
  accentBorder: string;
  label: string;
};

const PLATFORM_VISUALS: Record<string, PlatformVisual> = {
  youtube: {
    label: "YouTube",
    chipBg: "bg-red-500/15",
    chipText: "text-red-600 dark:text-red-400",
    accentBorder: "border-l-red-500/70",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
      >
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
  instagram: {
    label: "Instagram",
    chipBg: "bg-pink-500/15",
    chipText: "text-pink-600 dark:text-pink-400",
    accentBorder: "border-l-pink-500/70",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
      >
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
  },
  facebook: {
    label: "Facebook",
    chipBg: "bg-blue-500/15",
    chipText: "text-blue-600 dark:text-blue-400",
    accentBorder: "border-l-blue-500/70",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
      >
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  tiktok: {
    label: "TikTok",
    chipBg: "bg-slate-500/15",
    chipText: "text-slate-700 dark:text-slate-300",
    accentBorder: "border-l-slate-400/70",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
      >
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    ),
  },
};

const ALL_PLATFORMS_VISUAL: PlatformVisual = {
  label: "All Platforms",
  chipBg: "bg-emerald-500/15",
  chipText: "text-emerald-700 dark:text-emerald-400",
  accentBorder: "border-l-emerald-500/70",
  icon: (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
};

function formatRpmBadge(rpm: number) {
  const formatted = formatPriceInGel(rpm)
    .replace(/\.00$/, "")
    .replace(/,00$/, "");
  return `+${formatted}`;
}

function getPlatformVisual(
  platform: string | null,
  allPlatformsLabel: string,
): PlatformVisual {
  if (!platform) {
    return { ...ALL_PLATFORMS_VISUAL, label: allPlatformsLabel };
  }
  const key = platform.toLowerCase();
  return (
    PLATFORM_VISUALS[key] || {
      ...ALL_PLATFORMS_VISUAL,
      label: platform,
      accentBorder: "border-l-charcoal-300/70 dark:border-l-navy-500/70",
    }
  );
}

function platformSortIndex(platform: string | null) {
  if (platform === null) return -1;
  const idx = PLATFORM_ORDER.indexOf(platform.toLowerCase());
  return idx === -1 ? PLATFORM_ORDER.length : idx;
}

export default function CriteriaGrid({ criteria }: CriteriaGridProps) {
  const { t } = useI18n();

  const grouped = useMemo(() => {
    const map = new Map<string | null, ProjectCriteria[]>();
    criteria.forEach((c) => {
      const key = c.platform;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });

    map.forEach((items) =>
      items.sort((a, b) => a.display_order - b.display_order),
    );

    return Array.from(map.entries()).sort(
      ([a], [b]) => platformSortIndex(a) - platformSortIndex(b),
    );
  }, [criteria]);

  const totalRpm = useMemo(
    () => criteria.reduce((sum, c) => sum + c.rpm, 0),
    [criteria],
  );

  if (criteria.length === 0) return null;

  const allPlatformsLabel = t("activeProjects.allPlatforms") || "All Platforms";
  const rpmPerThousand = t("activeProjects.rpmPerThousand") || "per 1K views";

  return (
    <section>
      <div className="rounded-3xl border border-charcoal-100/70 dark:border-navy-700/70 bg-white dark:bg-navy-800/50 p-5 md:p-6 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-charcoal-950 dark:text-white">
              {t("activeProjects.criteria") || "Criteria"}
            </h2>
            <p className="text-sm text-charcoal-600 dark:text-gray-400 mt-1 max-w-2xl">
              {t("projectDetail.criteriaSubtitle") ||
                "Earn per 1,000 views when your video meets each requirement."}
            </p>
          </div>
          {totalRpm > 0 && (
            <div className="flex-shrink-0 inline-flex flex-col items-start sm:items-end rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800/80 dark:text-emerald-300/80">
                {t("activeProjects.potentialRPM") || "Potential RPM"}
              </span>
              <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {formatRpmBadge(totalRpm)}
              </span>
              <span className="text-[11px] text-emerald-700/70 dark:text-emerald-400/70 mt-0.5">
                {rpmPerThousand}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {grouped.map(([platform, items]) => {
          const visual = getPlatformVisual(platform, allPlatformsLabel);
          const groupTotal = items.reduce((sum, c) => sum + c.rpm, 0);

          return (
            <div
              key={platform || "all"}
              className="bg-white dark:bg-navy-800/90 border border-charcoal-100/70 dark:border-navy-700/70 rounded-2xl overflow-hidden shadow-soft"
            >
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-charcoal-100/60 dark:border-navy-700/60 bg-charcoal-50/60 dark:bg-navy-900/50">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${visual.chipBg} ${visual.chipText}`}
                >
                  {visual.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-charcoal-950 dark:text-white truncate">
                    {visual.label}
                  </h3>
                  <p className="text-xs text-charcoal-500 dark:text-gray-500">
                    {items.length === 1
                      ? t("projectDetail.oneCriterion") || "1 criterion"
                      : (
                          t("projectDetail.criteriaCount") ||
                          "{{count}} criteria"
                        ).replace("{{count}}", String(items.length))}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] uppercase tracking-wider text-charcoal-400 dark:text-gray-500">
                    {t("activeProjects.rpm") || "RPM"}
                  </p>
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {formatRpmBadge(groupTotal)}
                  </p>
                </div>
              </div>

              <ul className="divide-y divide-charcoal-100/70 dark:divide-navy-700/60">
                {items.map((c, index) => (
                  <li
                    key={c.id}
                    className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 py-3.5 border-l-[3px] ${visual.accentBorder} hover:bg-charcoal-50/80 dark:hover:bg-navy-700/25 transition-colors`}
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span
                        className="flex-shrink-0 w-8 h-8 rounded-lg bg-charcoal-100 dark:bg-navy-700 text-charcoal-700 dark:text-gray-200 flex items-center justify-center text-xs font-bold tabular-nums"
                        aria-hidden
                      >
                        {index + 1}
                      </span>
                      <p className="flex-1 min-w-0 text-sm text-charcoal-800 dark:text-gray-200 leading-relaxed pt-0.5">
                        {c.criteria_text}
                      </p>
                    </div>

                    <div className="flex-shrink-0 sm:text-right pl-11 sm:pl-0">
                      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200/80 dark:border-emerald-500/25 px-3 py-1.5 rounded-xl whitespace-nowrap">
                        {formatRpmBadge(c.rpm)}
                      </span>
                      <p className="text-[10px] text-charcoal-400 dark:text-gray-500 mt-1">
                        {rpmPerThousand}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
