"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/contexts/I18nContext";

const BANNER_DISMISS_KEY = "home_promo_banner_dismissed";
const PROMO_END_DATE = "2026-05-31T23:59:59+04:00";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function getTimeLeft(targetDate: number): TimeLeft {
  const now = Date.now();
  const diff = Math.max(0, targetDate - now);

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return { days, hours, minutes, seconds };
}

export default function PromoBanner() {
  const { t } = useI18n();
  const [hidden, setHidden] = useState(true);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() =>
    getTimeLeft(new Date(PROMO_END_DATE).getTime()),
  );
  const endTime = useMemo(() => new Date(PROMO_END_DATE).getTime(), []);

  useEffect(() => {
    const dismissed = localStorage.getItem(BANNER_DISMISS_KEY) === "true";
    setHidden(dismissed);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTimeLeft(getTimeLeft(endTime));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [endTime]);

  if (hidden) {
    return null;
  }

  const units = [
    {
      label: t("home.promo.days"),
      value: timeLeft.days.toString().padStart(2, "0"),
    },
    {
      label: t("home.promo.hours"),
      value: timeLeft.hours.toString().padStart(2, "0"),
    },
    {
      label: t("home.promo.minutes"),
      value: timeLeft.minutes.toString().padStart(2, "0"),
    },
    {
      label: t("home.promo.seconds"),
      value: timeLeft.seconds.toString().padStart(2, "0"),
    },
  ];

  return (
    <aside className="bg-red-600 text-white relative z-[60] border-b border-red-500/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex w-7 h-7 rounded-full bg-white/15 items-center justify-center flex-shrink-0">
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </span>
            <p className="text-sm md:text-base font-semibold truncate">
              {t("home.promo.message")}
            </p>
          </div>

          <div className="hidden md:flex items-center gap-2">
            {units.map((unit) => (
              <div key={unit.label} className="text-center">
                <div className="font-mono text-sm lg:text-base bg-black/25 px-2.5 py-1 rounded-md min-w-[46px]">
                  {unit.value}
                </div>
                <div className="text-[10px] uppercase tracking-wide mt-1 text-red-100">
                  {unit.label}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/courses"
              className="px-3 py-1.5 rounded-full text-xs md:text-sm font-semibold bg-white text-red-600 hover:bg-red-50 transition-colors"
            >
              {t("home.promo.cta")}
            </Link>
            <button
              type="button"
              onClick={() => {
                localStorage.setItem(BANNER_DISMISS_KEY, "true");
                setHidden(true);
              }}
              className="w-8 h-8 rounded-full hover:bg-white/15 inline-flex items-center justify-center transition-colors"
              aria-label={t("home.promo.dismiss")}
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
