"use client";

import { memo } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { useWelcomeDiscount } from "@/hooks/useWelcomeDiscount";

interface WelcomeDiscountCountdownProps {
  variant?: "compact" | "large";
  className?: string;
}

function formatParts(secondsRemaining: number): {
  hours: number;
  minutes: number;
  seconds: number;
} {
  const total = Math.max(0, secondsRemaining);
  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function WelcomeDiscountCountdown({
  variant = "compact",
  className = "",
}: WelcomeDiscountCountdownProps) {
  const { t } = useI18n();
  const { active, secondsRemaining } = useWelcomeDiscount();

  if (!active || secondsRemaining == null) return null;

  const { hours, minutes, seconds } = formatParts(secondsRemaining);

  if (variant === "compact") {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700/50 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums ${className}`}
        aria-label={t("welcomeDiscount.timeLeftLabel")}
      >
        <svg
          className="w-3 h-3"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" strokeLinecap="round" />
        </svg>
        <span>
          {pad2(hours)}:{pad2(minutes)}:{pad2(seconds)}
        </span>
      </span>
    );
  }

  // Large variant for the banner / modal header
  return (
    <span
      className={`inline-flex items-center gap-2 font-bold tabular-nums text-emerald-600 dark:text-emerald-300 ${className}`}
      aria-label={t("welcomeDiscount.timeLeftLabel")}
    >
      <span className="text-2xl md:text-3xl tracking-tight">
        {pad2(hours)}:{pad2(minutes)}:{pad2(seconds)}
      </span>
    </span>
  );
}

export default memo(WelcomeDiscountCountdown);
