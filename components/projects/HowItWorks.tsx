"use client";

import { useI18n } from "@/contexts/I18nContext";

const STEPS = [1, 2, 3, 4] as const;

export default function HowItWorks() {
  const { t } = useI18n();

  return (
    <section>
      <h2 className="text-2xl font-bold text-charcoal-950 dark:text-white mb-5">
        {t("projectDetail.howItWorks") || "How it works"}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {STEPS.map((n) => (
          <div
            key={n}
            className="bg-charcoal-50/80 dark:bg-navy-800/70 border border-charcoal-100/60 dark:border-navy-700/60 rounded-2xl p-5 hover:border-emerald-300/60 dark:hover:border-emerald-500/40 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-sm mb-3">
              {n}
            </div>
            <h3 className="text-base font-semibold text-charcoal-950 dark:text-white mb-1">
              {t(`projectDetail.step${n}Title`)}
            </h3>
            <p className="text-sm text-charcoal-600 dark:text-gray-400 leading-relaxed">
              {t(`projectDetail.step${n}Description`)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
