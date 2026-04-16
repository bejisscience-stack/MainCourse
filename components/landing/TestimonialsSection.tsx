"use client";

import { useI18n } from "@/contexts/I18nContext";
import { ScrollReveal } from "@/components/ScrollReveal";

const testimonials = ["one", "two", "three"] as const;

export default function TestimonialsSection() {
  const { t } = useI18n();

  return (
    <section className="px-4 sm:px-6 lg:px-8 pb-20 md:pb-28">
      <div className="max-w-7xl mx-auto">
        <ScrollReveal delay={0} duration={600}>
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-charcoal-950 dark:text-white tracking-tight">
              {t("home.testimonials.title")}
            </h2>
            <p className="mt-3 text-base md:text-lg text-charcoal-600 dark:text-gray-300">
              {t("home.testimonials.subtitle")}
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {testimonials.map((entry, index) => (
            <ScrollReveal key={entry} delay={index * 80} duration={500}>
              <article className="rounded-2xl bg-white/90 dark:bg-navy-800/80 border border-charcoal-200/60 dark:border-navy-700 p-6 h-full">
                <svg
                  className="w-6 h-6 text-emerald-500 mb-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M7.17 6A5.001 5.001 0 002 11v7a2 2 0 002 2h5a2 2 0 002-2v-7a2 2 0 00-2-2H6.09A3.001 3.001 0 017.17 6zM17.17 6A5.001 5.001 0 0012 11v7a2 2 0 002 2h5a2 2 0 002-2v-7a2 2 0 00-2-2h-2.91A3.001 3.001 0 0117.17 6z" />
                </svg>
                <p className="text-charcoal-800 dark:text-gray-200 leading-relaxed">
                  {t(`home.testimonials.items.${entry}.quote`)}
                </p>
                <div className="mt-5 pt-4 border-t border-charcoal-200/70 dark:border-navy-700">
                  <p className="font-semibold text-charcoal-950 dark:text-white">
                    {t(`home.testimonials.items.${entry}.name`)}
                  </p>
                  <p className="text-sm text-charcoal-500 dark:text-gray-400">
                    {t(`home.testimonials.items.${entry}.meta`)}
                  </p>
                </div>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
