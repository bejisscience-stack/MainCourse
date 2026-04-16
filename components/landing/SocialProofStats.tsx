"use client";

import { useI18n } from "@/contexts/I18nContext";
import { ScrollReveal } from "@/components/ScrollReveal";

const stats = [
  { key: "students", value: "500+" },
  { key: "courses", value: "10+" },
  { key: "satisfaction", value: "95%" },
] as const;

export default function SocialProofStats() {
  const { t } = useI18n();

  return (
    <section className="px-4 sm:px-6 lg:px-8 pb-20 md:pb-28">
      <div className="max-w-7xl mx-auto rounded-3xl bg-charcoal-950 dark:bg-navy-900 border border-charcoal-800 dark:border-navy-700 p-8 md:p-12">
        <ScrollReveal delay={0} duration={550}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            {stats.map((stat) => (
              <div key={stat.key}>
                <p className="text-4xl md:text-5xl font-bold text-white">
                  {stat.value}
                </p>
                <p className="mt-2 text-charcoal-300 dark:text-gray-300 text-sm md:text-base">
                  {t(`home.socialProof.${stat.key}`)}
                </p>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
