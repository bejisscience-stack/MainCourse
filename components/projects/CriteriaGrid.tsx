"use client";

import { useMemo } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { formatPriceInGel } from "@/lib/currency";
import type { ProjectCriteria } from "@/hooks/useActiveProjects";
import { getPlatformVisual } from "@/components/projects/platformVisuals";

interface CriteriaGridProps {
  criteria: ProjectCriteria[];
}

const PLATFORM_ORDER = ["youtube", "instagram", "tiktok", "facebook"];

function formatRpmBadge(rpm: number) {
  const formatted = formatPriceInGel(rpm)
    .replace(/\.00$/, "")
    .replace(/,00$/, "");
  return `+${formatted}`;
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
