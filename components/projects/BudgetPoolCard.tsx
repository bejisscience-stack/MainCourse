"use client";

import { useMemo } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { formatPriceInGel } from "@/lib/currency";
import { useProjectBudget } from "@/hooks/useProjectBudget";
import type { ActiveProject } from "@/hooks/useActiveProjects";

interface BudgetPoolCardProps {
  project: ActiveProject;
  primaryAction: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  referenceVideoUrl?: string | null;
}

const stripDecimals = (gel: string) =>
  gel.replace(/\.00$/, "").replace(/,00$/, "");

function formatViews(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.floor(n / 1_000)}K`;
  return n.toLocaleString();
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function BudgetPoolCard({
  project,
  primaryAction,
  referenceVideoUrl,
}: BudgetPoolCardProps) {
  const { t } = useI18n();
  const budget = useProjectBudget(project.id, project.budget);

  const totalLabel = useMemo(
    () => stripDecimals(formatPriceInGel(project.budget)),
    [project.budget],
  );
  const remainingLabel = useMemo(
    () => stripDecimals(formatPriceInGel(budget.remainingBudget)),
    [budget.remainingBudget],
  );

  const durationDays = useMemo(() => {
    if (!project.start_date || !project.end_date) return null;
    const start = new Date(project.start_date);
    const end = new Date(project.end_date);
    const diff = Math.max(
      0,
      Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
    );
    return diff;
  }, [project.start_date, project.end_date]);

  const barColor = useMemo(() => {
    switch (budget.status) {
      case "depleted":
        return "bg-gray-400 dark:bg-gray-600";
      case "critical":
        return "bg-red-500 dark:bg-red-500";
      case "low":
        return "bg-amber-500 dark:bg-amber-500";
      default:
        return "bg-emerald-500 dark:bg-emerald-500";
    }
  }, [budget.status]);

  return (
    <aside className="bg-white dark:bg-navy-800 rounded-3xl border border-charcoal-100/60 dark:border-navy-700/60 shadow-soft lg:shadow-lg lg:ring-1 lg:ring-charcoal-100/80 dark:lg:ring-navy-600/50 p-6 md:p-7 space-y-5">
      {/* Total budget header */}
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-charcoal-500 dark:text-gray-400">
          {t("projectDetail.budgetPool") || "Budget Pool"}
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl md:text-4xl font-bold text-charcoal-950 dark:text-white tracking-tight">
            {totalLabel}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-4 w-full h-2 bg-charcoal-100 dark:bg-navy-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${barColor}`}
            style={{ width: `${budget.percentageRemaining}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-charcoal-500 dark:text-gray-400">
            {t("activeProjects.remaining") || "Remaining"}:{" "}
            <span className="font-semibold text-charcoal-900 dark:text-white">
              {remainingLabel}
            </span>
          </span>
          <span
            className={
              budget.status === "depleted"
                ? "text-gray-500"
                : budget.status === "critical"
                  ? "text-red-500 dark:text-red-400 font-semibold"
                  : budget.status === "low"
                    ? "text-amber-500 dark:text-amber-400 font-semibold"
                    : "text-emerald-600 dark:text-emerald-400 font-semibold"
            }
          >
            {Math.round(budget.percentageRemaining)}%
          </span>
        </div>
      </div>

      {/* Metadata rows */}
      <div className="divide-y divide-charcoal-100 dark:divide-navy-700/70 border-t border-charcoal-100 dark:border-navy-700/70">
        <Row
          label={t("activeProjects.viewRange") || "View range"}
          value={`${formatViews(project.min_views)} – ${formatViews(project.max_views)}`}
        />
        {durationDays !== null && (
          <Row
            label={t("activeProjects.duration") || "Duration"}
            value={`${durationDays} ${t("projectDetail.daysShort") || "d"}`}
          />
        )}
        <Row
          label={t("projectDetail.starts") || "Starts"}
          value={formatDate(project.start_date)}
        />
        <Row
          label={t("projectDetail.ends") || "Ends"}
          value={formatDate(project.end_date)}
        />
        <Row
          label={t("activeProjects.platforms") || "Platforms"}
          value={
            <div className="flex flex-wrap gap-1 justify-end">
              {project.platforms.map((p) => (
                <span
                  key={p}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-charcoal-100 text-charcoal-700 dark:bg-navy-700 dark:text-gray-200 capitalize border border-charcoal-200/60 dark:border-navy-600/60"
                >
                  {p}
                </span>
              ))}
            </div>
          }
        />
      </div>

      {/* CTA */}
      <button
        onClick={primaryAction.onClick}
        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-white bg-charcoal-950 dark:bg-emerald-500 rounded-2xl hover:bg-charcoal-800 dark:hover:bg-emerald-600 shadow-soft hover:shadow-glow transition-all duration-200"
      >
        {primaryAction.icon}
        {primaryAction.label}
      </button>

      {referenceVideoUrl && (
        <a
          href={referenceVideoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded-2xl transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {t("activeProjects.referenceVideo") || "Reference Video"}
        </a>
      )}
    </aside>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 text-sm gap-4">
      <span className="text-charcoal-500 dark:text-gray-400 whitespace-nowrap">
        {label}
      </span>
      <span className="font-semibold text-charcoal-900 dark:text-white text-right min-w-0">
        {value}
      </span>
    </div>
  );
}
