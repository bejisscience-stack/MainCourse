"use client";

import Link from "next/link";
import { useI18n } from "@/contexts/I18nContext";
import { useUser } from "@/hooks/useUser";

export default function FinalEnrollCta() {
  const { t } = useI18n();
  const { user } = useUser();

  const href = user ? "/courses" : "/signup";

  return (
    <section className="px-4 sm:px-6 lg:px-8 pb-20 md:pb-28">
      <div className="max-w-7xl mx-auto rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-400/10 to-cyan-500/10 dark:from-emerald-500/20 dark:to-cyan-500/15 p-8 md:p-14 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-charcoal-950 dark:text-white tracking-tight">
          {t("home.finalCta.title")}
        </h2>
        <p className="mt-4 max-w-2xl mx-auto text-charcoal-700 dark:text-gray-300 text-base md:text-lg">
          {t("home.finalCta.subtitle")}
        </p>
        <Link
          href={href}
          className="mt-7 inline-flex items-center justify-center px-8 py-3.5 rounded-full bg-charcoal-950 dark:bg-emerald-500 text-white font-semibold hover:bg-charcoal-800 dark:hover:bg-emerald-600 transition-colors"
        >
          {t("home.finalCta.button")}
        </Link>
      </div>
    </section>
  );
}
