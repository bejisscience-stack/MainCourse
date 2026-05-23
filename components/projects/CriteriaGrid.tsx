"use client";

import { useMemo } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { formatPriceInGel } from "@/lib/currency";
import type { ProjectCriteria } from "@/hooks/useActiveProjects";

interface CriteriaGridProps {
  criteria: ProjectCriteria[];
}

const PLATFORM_LABEL: Record<string, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
};

export default function CriteriaGrid({ criteria }: CriteriaGridProps) {
  const { t } = useI18n();

  const grouped = useMemo(() => {
    const map = new Map<string | null, ProjectCriteria[]>();
    criteria.forEach((c) => {
      const key = c.platform;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });
    return Array.from(map.entries());
  }, [criteria]);

  if (criteria.length === 0) return null;

  return (
    <section>
      <h2 className="text-2xl font-bold text-charcoal-950 dark:text-white mb-5">
        {t("activeProjects.criteria") || "Criteria"}
      </h2>

      <div className="space-y-5">
        {grouped.map(([platform, items]) => (
          <div key={platform || "all"}>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-charcoal-500 dark:text-gray-400 mb-2">
              {platform
                ? PLATFORM_LABEL[platform.toLowerCase()] || platform
                : t("activeProjects.allPlatforms") || "All platforms"}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {items.map((c) => (
                <div
                  key={c.id}
                  className="flex items-start justify-between gap-3 bg-white dark:bg-navy-800 border border-charcoal-100/60 dark:border-navy-700/60 rounded-2xl p-4 shadow-soft"
                >
                  <span className="text-sm text-charcoal-800 dark:text-gray-200 leading-relaxed flex-1">
                    {c.criteria_text}
                  </span>
                  <span className="flex-shrink-0 text-sm font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 px-3 py-1 rounded-lg whitespace-nowrap">
                    +
                    {formatPriceInGel(c.rpm)
                      .replace(/\.00$/, "")
                      .replace(/,00$/, "")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
