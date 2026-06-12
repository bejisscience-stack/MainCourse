"use client";

import { useI18n } from "@/contexts/I18nContext";
import type { CountdownResult } from "@/hooks/useProjectCountdown";

interface HeroCountdownChipProps {
  countdown: CountdownResult;
  startDate: string;
}

/**
 * Small urgency chip for the project hero. Renders nothing when expired —
 * the status pill already covers that. countdown.formattedTime is hardcoded
 * English, so the label is built from timeRemaining + i18n instead.
 */
export default function HeroCountdownChip({
  countdown,
  startDate,
}: HeroCountdownChipProps) {
  const { t } = useI18n();

  if (countdown.isExpired) return null;

  let label: string;
  if (!countdown.isStarted) {
    const daysUntilStart = Math.max(
      1,
      Math.ceil(
        (new Date(startDate + "T00:00:00").getTime() - Date.now()) / 86_400_000,
      ),
    );
    label = t("projectDetail.startsInDays", { days: daysUntilStart });
  } else if (countdown.timeRemaining.days > 0) {
    label = t("projectDetail.endsInDays", {
      days: countdown.timeRemaining.days,
    });
  } else if (countdown.timeRemaining.hours > 0) {
    label = t("projectDetail.endsInHours", {
      hours: countdown.timeRemaining.hours,
    });
  } else {
    label = t("projectsPage.statusEndingSoon");
  }

  const isUrgent = countdown.isStarted && countdown.timeRemaining.days <= 3;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm border ${
        isUrgent
          ? "bg-amber-500/20 text-amber-200 border-amber-400/30"
          : "bg-white/15 text-white border-white/15"
      }`}
    >
      <svg
        className="w-3.5 h-3.5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      {label}
    </span>
  );
}
