"use client";

import { useI18n } from "@/contexts/I18nContext";
import { useProjectSubmissions } from "@/hooks/useProjectSubmissions";

interface RecentSubmissionsProps {
  projectId: string;
}

function timeAgo(iso: string, locale: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return locale === "ge" ? "ახლახან" : "just now";
  if (diffMin < 60)
    return locale === "ge" ? `${diffMin} წთ-ის წინ` : `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)
    return locale === "ge" ? `${diffH} სთ-ის წინ` : `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return locale === "ge" ? `${diffD} დღის წინ` : `${diffD}d ago`;
  return new Date(iso).toLocaleDateString(locale === "ge" ? "ka-GE" : "en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function RecentSubmissions({
  projectId,
}: RecentSubmissionsProps) {
  const { t, language } = useI18n();
  const { submissions, isLoading } = useProjectSubmissions(projectId, 10);

  return (
    <section>
      <h2 className="text-2xl font-bold text-charcoal-950 dark:text-white mb-5">
        {t("projectDetail.recentSubmissions") || "Recent Submissions"}
      </h2>

      <div className="bg-white dark:bg-navy-800 border border-charcoal-100/60 dark:border-navy-700/60 rounded-3xl overflow-hidden shadow-soft">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-charcoal-100 dark:bg-navy-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 bg-charcoal-100 dark:bg-navy-700 rounded" />
                  <div className="h-2.5 w-1/5 bg-charcoal-100 dark:bg-navy-700 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : submissions.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-charcoal-100 dark:bg-navy-700 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-charcoal-400 dark:text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
            <p className="text-sm text-charcoal-600 dark:text-gray-400">
              {t("projectDetail.noSubmissions") ||
                "No submissions yet — be the first."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-charcoal-100 dark:divide-navy-700/70">
            {submissions.map((s, idx) => {
              const name =
                s.submitter_full_name ||
                s.submitter_username ||
                t("activeProjects.unknownLecturer");
              const initial = (name || "?").trim().charAt(0).toUpperCase();
              return (
                <li
                  key={s.id}
                  className="flex items-center gap-3 px-5 py-4 hover:bg-charcoal-50/60 dark:hover:bg-navy-700/40 transition-colors"
                >
                  <div className="flex-shrink-0 w-9 text-xs font-semibold text-charcoal-400 dark:text-gray-500 tabular-nums">
                    {String(idx + 1).padStart(2, "0")}
                  </div>
                  <div className="flex-shrink-0">
                    {s.submitter_avatar_url ? (
                      <img
                        src={s.submitter_avatar_url}
                        alt={name}
                        className="w-10 h-10 rounded-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-semibold text-sm">
                        {initial}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-charcoal-900 dark:text-white truncate">
                      {name}
                    </div>
                    <div className="text-xs text-charcoal-500 dark:text-gray-400">
                      {timeAgo(s.created_at, language)}
                    </div>
                  </div>
                  {s.video_url && (
                    <a
                      href={s.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-charcoal-100 dark:bg-navy-700 text-charcoal-700 dark:text-gray-200 hover:bg-emerald-500/15 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                      aria-label={t("activeProjects.viewVideo") || "View video"}
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
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
