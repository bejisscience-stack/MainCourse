"use client";

import { useI18n } from "@/contexts/I18nContext";
import { formatPriceInGel } from "@/lib/currency";
import { timeAgo } from "@/lib/timeAgo";
import { getPlatformVisual } from "@/components/projects/platformVisuals";
import type { MyProjectSubmission } from "@/hooks/useMyProjectSubmissions";
import type { SubmissionReviewSummary } from "@/hooks/useProjectSubmissions";

interface MySubmissionsProps {
  submissions: MyProjectSubmission[];
  isLoading: boolean;
}

const STATUS_STYLES: Record<SubmissionReviewSummary["status"], string> = {
  pending:
    "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25",
  accepted:
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
  rejected: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/25",
};

const STATUS_LABEL_KEYS: Record<SubmissionReviewSummary["status"], string> = {
  pending: "projectDetail.statusInReview",
  accepted: "projectDetail.statusAccepted",
  rejected: "projectDetail.statusRejected",
};

function submissionLink(s: MyProjectSubmission): string | null {
  if (s.video_url) return s.video_url;
  const links = s.platform_links ? Object.values(s.platform_links) : [];
  return links.find((l) => !!l) ?? null;
}

/** The viewer's own submissions with per-platform review status. */
export default function MySubmissions({
  submissions,
  isLoading,
}: MySubmissionsProps) {
  const { t, language } = useI18n();

  // Users who never submitted shouldn't see a skeleton flash — the section
  // simply appears once data arrives.
  if (isLoading || submissions.length === 0) return null;

  const allPlatformsLabel = t("activeProjects.allPlatforms") || "All Platforms";

  return (
    <section>
      <h2 className="text-2xl font-bold text-charcoal-950 dark:text-white mb-1">
        {t("projectDetail.mySubmissions")}
      </h2>
      <p className="text-sm text-charcoal-600 dark:text-gray-400 mb-5">
        {t("projectDetail.mySubmissionsHint")}
      </p>

      <div className="bg-white dark:bg-navy-800 border border-charcoal-100/60 dark:border-navy-700/60 ring-1 ring-emerald-500/20 rounded-3xl overflow-hidden shadow-soft">
        <ul className="divide-y divide-charcoal-100 dark:divide-navy-700/70">
          {submissions.map((s) => {
            const link = submissionLink(s);
            const earned = s.reviews
              .filter((r) => r.status === "accepted")
              .reduce((sum, r) => sum + r.payment_amount, 0);

            return (
              <li
                key={s.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-sm text-charcoal-500 dark:text-gray-400 whitespace-nowrap">
                    {timeAgo(s.created_at, language)}
                  </span>
                  {link && (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors truncate"
                    >
                      <svg
                        className="w-3.5 h-3.5 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                      {t("projects.videoLink") || "Video link"}
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                  {s.reviews.length === 0 ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-charcoal-100 dark:bg-navy-700 text-charcoal-600 dark:text-gray-300 border border-charcoal-200/60 dark:border-navy-600/60">
                      <svg
                        className="w-3 h-3"
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
                      {t("projectDetail.statusAwaitingReview")}
                    </span>
                  ) : (
                    s.reviews.map((review, i) => {
                      const visual = getPlatformVisual(
                        review.platform === "all" ? null : review.platform,
                        allPlatformsLabel,
                      );
                      return (
                        <span
                          key={`${review.platform}-${i}`}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border [&_svg]:w-3.5 [&_svg]:h-3.5 ${STATUS_STYLES[review.status]}`}
                          title={visual.label}
                        >
                          {visual.icon}
                          {t(STATUS_LABEL_KEYS[review.status])}
                        </span>
                      );
                    })
                  )}
                  {earned > 0 && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 tabular-nums">
                      {t("projectDetail.earned")}{" "}
                      {formatPriceInGel(earned)
                        .replace(/\.00$/, "")
                        .replace(/,00$/, "")}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
