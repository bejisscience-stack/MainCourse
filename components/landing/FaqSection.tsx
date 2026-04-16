"use client";

import { useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { ScrollReveal } from "@/components/ScrollReveal";

const faqKeys = [
  "coursesWork",
  "paymentMethods",
  "refunds",
  "access",
  "earnings",
  "support",
] as const;

export default function FaqSection() {
  const { t } = useI18n();
  const [openItem, setOpenItem] = useState<string>(faqKeys[0]);

  return (
    <section className="px-4 sm:px-6 lg:px-8 pb-20 md:pb-28">
      <div className="max-w-3xl mx-auto">
        <ScrollReveal delay={0} duration={550}>
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-charcoal-950 dark:text-white tracking-tight">
              {t("home.faq.title")}
            </h2>
            <p className="mt-3 text-base md:text-lg text-charcoal-600 dark:text-gray-300">
              {t("home.faq.subtitle")}
            </p>
          </div>
        </ScrollReveal>

        <div className="rounded-2xl border border-charcoal-200/70 dark:border-navy-700 bg-white/85 dark:bg-navy-800/70 divide-y divide-charcoal-200/70 dark:divide-navy-700">
          {faqKeys.map((key) => {
            const isOpen = openItem === key;
            return (
              <div key={key}>
                <button
                  type="button"
                  onClick={() =>
                    setOpenItem((prev) => (prev === key ? "" : key))
                  }
                  className="w-full flex items-center justify-between text-left px-5 md:px-6 py-4"
                >
                  <span className="font-semibold text-charcoal-900 dark:text-white pr-4">
                    {t(`home.faq.items.${key}.question`)}
                  </span>
                  <svg
                    className={`w-5 h-5 text-charcoal-500 dark:text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {isOpen && (
                  <div className="px-5 md:px-6 pb-4">
                    <p className="text-charcoal-600 dark:text-gray-300 leading-relaxed">
                      {t(`home.faq.items.${key}.answer`)}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
