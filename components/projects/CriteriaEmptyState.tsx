"use client";

import { useI18n } from "@/contexts/I18nContext";

/** Shown in place of CriteriaGrid when a project has no criteria yet. */
export default function CriteriaEmptyState() {
  const { t } = useI18n();

  return (
    <section>
      <h2 className="text-2xl font-bold text-charcoal-950 dark:text-white mb-5">
        {t("activeProjects.criteria") || "Criteria"}
      </h2>
      <div className="rounded-3xl border border-charcoal-100/70 dark:border-navy-700/70 bg-white dark:bg-navy-800/50 p-6 md:p-8 flex items-start gap-4">
        <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
        </div>
        <div>
          <h3 className="text-base font-semibold text-charcoal-950 dark:text-white mb-1">
            {t("projectDetail.noCriteriaTitle")}
          </h3>
          <p className="text-sm text-charcoal-600 dark:text-gray-400 leading-relaxed max-w-md">
            {t("projectDetail.noCriteriaBody")}
          </p>
        </div>
      </div>
    </section>
  );
}
