"use client";

import { useI18n } from "@/contexts/I18nContext";
import { ScrollReveal } from "@/components/ScrollReveal";

const cards = [
  { key: "selfPaced", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
  {
    key: "projects",
    icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
  },
  {
    key: "experts",
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  },
  {
    key: "community",
    icon: "M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m8 5v-2a4 4 0 00-3-3.87m-6 3.87A4 4 0 019 14m0 0a4 4 0 108 0 4 4 0 00-8 0zm-6 0a4 4 0 118 0 4 4 0 01-8 0z",
  },
  {
    key: "support",
    icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-4 4v-4z",
  },
  {
    key: "bilingual",
    icon: "M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7m-7 0a19.061 19.061 0 01-2.452-5.5m2.452 5.5a19.061 19.061 0 002.452-5.5m0 0A18.022 18.022 0 0117.588 9m-5.088 3h.01",
  },
  {
    key: "secure",
    icon: "M12 11c1.657 0 3-1.79 3-4s-1.343-4-3-4-3 1.79-3 4 1.343 4 3 4zm0 0v10m-4-4h8",
  },
  {
    key: "earn",
    icon: "M12 8c-2.21 0-4 .895-4 2s1.79 2 4 2 4 .895 4 2-1.79 2-4 2m0-10V6m0 12v-2m9-4a9 9 0 11-18 0 9 9 0 0118 0z",
  },
] as const;

export default function ValuePropsGrid() {
  const { t } = useI18n();

  return (
    <section className="px-4 sm:px-6 lg:px-8 pb-20 md:pb-28">
      <div className="max-w-7xl mx-auto">
        <ScrollReveal delay={0} duration={600}>
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-charcoal-950 dark:text-white tracking-tight">
              {t("home.valueGrid.title")}
            </h2>
            <p className="mt-3 text-base md:text-lg text-charcoal-600 dark:text-gray-300">
              {t("home.valueGrid.subtitle")}
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card, index) => (
            <ScrollReveal key={card.key} delay={index * 60} duration={500}>
              <article className="rounded-2xl border border-charcoal-200/60 dark:border-navy-700 bg-white/80 dark:bg-navy-800/80 backdrop-blur-sm p-5 h-full">
                <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={card.icon}
                    />
                  </svg>
                </span>
                <h3 className="mt-4 text-base font-semibold text-charcoal-950 dark:text-white">
                  {t(`home.valueGrid.items.${card.key}.title`)}
                </h3>
                <p className="mt-1.5 text-sm text-charcoal-600 dark:text-gray-400 leading-relaxed">
                  {t(`home.valueGrid.items.${card.key}.description`)}
                </p>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
