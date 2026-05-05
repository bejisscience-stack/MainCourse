"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/contexts/I18nContext";
import { useUser } from "@/hooks/useUser";
import { useWelcomeDiscount } from "@/hooks/useWelcomeDiscount";
import WelcomeDiscountCountdown from "./WelcomeDiscountCountdown";

const DISMISS_KEY = "welcomeDiscount.bannerDismissed";
// CSS variable consumed by Navigation (top offset) and the layout content
// wrapper (top padding) so the banner pushes the rest of the chrome down
// rather than overlapping the fixed nav (z-50).
const BANNER_HEIGHT_VAR = "--welcome-banner-h";

export default function WelcomeDiscountBanner() {
  const { t } = useI18n();
  const { user } = useUser();
  const { active } = useWelcomeDiscount();
  const [dismissed, setDismissed] = useState(true); // start hidden, hydrate on mount
  const bannerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  const isShown = Boolean(user && active && !dismissed);

  // Publish the banner's measured height as a CSS variable on <html> so the
  // fixed Navigation can offset its `top` and the layout can pad its content.
  // Reset to 0 whenever the banner is hidden / unmounted.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (!isShown) {
      root.style.setProperty(BANNER_HEIGHT_VAR, "0px");
      return;
    }

    const updateHeight = () => {
      const h = bannerRef.current?.offsetHeight ?? 0;
      root.style.setProperty(BANNER_HEIGHT_VAR, `${h}px`);
    };
    updateHeight();

    let observer: ResizeObserver | null = null;
    if (bannerRef.current && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(updateHeight);
      observer.observe(bannerRef.current);
    }

    return () => {
      observer?.disconnect();
      root.style.setProperty(BANNER_HEIGHT_VAR, "0px");
    };
  }, [isShown]);

  if (!isShown) return null;

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(DISMISS_KEY, "1");
    }
    setDismissed(true);
  };

  return (
    <div
      ref={bannerRef}
      className="fixed top-0 left-0 right-0 z-[60] w-full bg-gradient-to-r from-emerald-500 via-emerald-500 to-teal-500 text-white shadow-soft"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-2 md:py-2.5 flex items-center gap-2 md:gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm md:text-lg font-bold tracking-tight">
            {t("welcomeDiscount.bannerTitle")}
          </span>
          <span className="hidden sm:inline text-sm text-emerald-50/90">
            {t("welcomeDiscount.bannerSubtitle")}
          </span>
        </div>
        <div className="rounded-lg bg-white/15 px-2 py-0.5 md:px-3 md:py-1 backdrop-blur">
          <WelcomeDiscountCountdown variant="large" className="!text-white" />
        </div>
        <Link
          href="/courses"
          className="inline-flex items-center justify-center px-3 py-1 md:px-4 md:py-1.5 text-xs md:text-sm font-semibold text-emerald-700 bg-white rounded-full hover:bg-emerald-50 transition-colors"
        >
          {t("welcomeDiscount.bannerCta")}
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t("common.close")}
          className="inline-flex items-center justify-center w-7 h-7 rounded-full hover:bg-white/15 transition-colors"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
