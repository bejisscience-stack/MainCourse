"use client";

import { useI18n } from "@/contexts/I18nContext";

const badges = [
  {
    key: "secure",
    icon: "M12 3l8 4v5c0 5.25-3.438 9.992-8 11-4.562-1.008-8-5.75-8-11V7l8-4z",
  },
  {
    key: "instructors",
    icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  },
  { key: "pace", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
  {
    key: "community",
    icon: "M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m8 5v-2a4 4 0 00-3-3.87m-6 3.87A4 4 0 019 14m0 0a4 4 0 108 0 4 4 0 00-8 0zm-6 0a4 4 0 118 0 4 4 0 01-8 0z",
  },
] as const;

export default function TrustStrip() {
  const { t } = useI18n();

  return (
    <section className="px-4 sm:px-6 lg:px-8 pb-12 md:pb-16">
      <div className="max-w-7xl mx-auto rounded-2xl border border-charcoal-200/70 dark:border-navy-700 bg-white/80 dark:bg-navy-800/70 backdrop-blur-sm px-5 py-5 md:px-8">
        <div className="flex gap-4 md:gap-8 overflow-x-auto scrollbar-hide">
          {badges.map((badge) => (
            <div
              key={badge.key}
              className="min-w-max flex items-center gap-2.5 text-charcoal-700 dark:text-gray-300"
            >
              <span className="inline-flex w-8 h-8 rounded-full items-center justify-center bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d={badge.icon}
                  />
                </svg>
              </span>
              <p className="text-sm font-medium">
                {t(`home.trustStrip.${badge.key}`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
