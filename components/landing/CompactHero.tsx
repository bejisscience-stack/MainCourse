"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/contexts/I18nContext";
import { useUser } from "@/hooks/useUser";
import { ScrollReveal } from "@/components/ScrollReveal";

const categoryChips = [
  {
    key: "editing",
    value: "Editing",
    color:
      "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300",
  },
  {
    key: "contentCreation",
    value: "Content Creation",
    color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300",
  },
  {
    key: "websiteCreation",
    value: "Website Creation",
    color:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  },
] as const;

export default function CompactHero() {
  const { t } = useI18n();
  const router = useRouter();
  const { user, role } = useUser();
  const [query, setQuery] = useState("");

  const primaryCta = useMemo(() => {
    if (!user) return { href: "/signup", label: t("home.hero.primaryGuest") };
    if (role === "admin")
      return { href: "/admin", label: t("home.hero.primaryAdmin") };
    if (role === "lecturer") {
      return {
        href: "/lecturer/dashboard",
        label: t("home.hero.primaryLecturer"),
      };
    }
    return { href: "/courses", label: t("home.hero.primaryStudent") };
  }, [role, t, user]);

  const onSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = query.trim();
    if (!value) {
      router.push("/courses");
      return;
    }
    router.push(`/courses?q=${encodeURIComponent(value)}`);
  };

  return (
    <section className="pt-28 md:pt-44 pb-14 md:pb-20 px-4 sm:px-6 lg:px-8 relative z-[2] overflow-hidden">
      <div className="absolute inset-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[420px] pointer-events-none blur-3xl">
        <div className="w-full h-full bg-gradient-radial from-emerald-400/10 via-emerald-300/5 to-transparent dark:from-emerald-400/20 dark:via-emerald-500/10 dark:to-transparent" />
      </div>

      <div className="max-w-5xl mx-auto text-center relative z-10">
        <ScrollReveal delay={0} duration={500}>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-charcoal-950 dark:text-white tracking-tight leading-tight">
            {t("home.hero.title")}
          </h1>
        </ScrollReveal>

        <ScrollReveal delay={80} duration={500}>
          <p className="mt-5 text-base sm:text-lg md:text-xl text-charcoal-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
            {t("home.hero.subtitle")}
          </p>
        </ScrollReveal>

        <ScrollReveal delay={140} duration={500}>
          <form onSubmit={onSearchSubmit} className="mt-8 max-w-xl mx-auto">
            <div className="flex items-center rounded-full bg-white dark:bg-navy-800 border border-charcoal-200 dark:border-navy-700 shadow-soft overflow-hidden">
              <span className="pl-4 text-charcoal-500 dark:text-gray-400">
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
                    d="M21 21l-4.35-4.35m1.85-5.65a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z"
                  />
                </svg>
              </span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("home.hero.searchPlaceholder")}
                className="w-full px-3 py-3.5 bg-transparent text-charcoal-950 dark:text-white outline-none placeholder:text-charcoal-400 dark:placeholder:text-gray-500"
                aria-label={t("home.hero.searchPlaceholder")}
              />
              <button
                type="submit"
                className="m-1.5 px-4 py-2 rounded-full bg-charcoal-950 dark:bg-emerald-500 text-white text-sm font-semibold hover:bg-charcoal-800 dark:hover:bg-emerald-600 transition-colors"
              >
                {t("home.hero.searchCta")}
              </button>
            </div>
          </form>
        </ScrollReveal>

        <ScrollReveal delay={200} duration={500}>
          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-6">
            {categoryChips.map((chip) => (
              <Link
                key={chip.value}
                href={`/courses?filter=${encodeURIComponent(chip.value)}`}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-transform hover:-translate-y-0.5 ${chip.color}`}
              >
                {t(`home.hero.category.${chip.key}`)}
              </Link>
            ))}
          </div>
        </ScrollReveal>

        <ScrollReveal delay={260} duration={500}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-9">
            <Link
              href={primaryCta.href}
              className="group px-7 py-3.5 bg-charcoal-950 dark:bg-emerald-500 text-white rounded-full font-semibold text-sm md:text-base hover:bg-charcoal-800 dark:hover:bg-emerald-600 transition-all duration-200"
            >
              {primaryCta.label}
              <span className="inline-block ml-2 transition-transform duration-200 group-hover:translate-x-1">
                →
              </span>
            </Link>
            <Link
              href="/courses"
              className="px-7 py-3.5 rounded-full border border-emerald-500 text-emerald-600 dark:text-emerald-400 font-semibold text-sm md:text-base hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
            >
              {t("home.hero.secondaryCta")}
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
