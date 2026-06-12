"use client";

import { useI18n } from "@/contexts/I18nContext";

export default function ProjectsHero() {
  const { t } = useI18n();

  return (
    <div className="text-center mb-8">
      <span className="inline-flex items-center gap-1.5 px-4 py-1.5 mb-5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm font-semibold rounded-full">
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
            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
        {t("projectsPage.heroEyebrow")}
      </span>
      <h1 className="text-3xl md:text-5xl font-bold text-charcoal-950 dark:text-white mb-4 tracking-tight">
        {t("projectsPage.heroTitle")}
      </h1>
      <p className="text-lg text-charcoal-600 dark:text-gray-400 max-w-2xl mx-auto">
        {t("projectsPage.heroDescription")}
      </p>
    </div>
  );
}
