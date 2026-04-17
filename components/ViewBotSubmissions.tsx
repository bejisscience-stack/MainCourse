"use client";

import React, { useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { useSubmissionViewHistory } from "@/hooks/useSubmissionViewHistory";
import type {
  SubmissionWithViews,
  SubmissionReviewData,
  Platform,
} from "@/types/view-scraper";

interface ViewBotSubmissionsProps {
  submissions: SubmissionWithViews[];
  isLoading: boolean;
  filters: { projectId: string | null; platform: Platform | null };
  onFilterChange: (filters: {
    projectId: string | null;
    platform: Platform | null;
  }) => void;
  onCheckNow: (submissionId: string) => void;
  onPay: (
    submissionId: string,
    reviewId: string,
    payoutAmount: number,
    studentName: string,
  ) => void;
  projects: { id: string; title: string }[];
  checkingId: string | null;
  payingId: string | null;
}

function HistoryRow({ submissionId }: { submissionId: string }) {
  const { history, isLoading } = useSubmissionViewHistory(submissionId);
  const { t } = useI18n();

  if (isLoading)
    return (
      <tr>
        <td colSpan={9} className="px-4 py-3 text-center text-gray-400 text-sm">
          {t("common.loading")}
        </td>
      </tr>
    );
  if (history.length === 0)
    return (
      <tr>
        <td colSpan={9} className="px-4 py-3 text-center text-gray-400 text-sm">
          {t("viewBot.noHistory")}
        </td>
      </tr>
    );

  return (
    <>
      {history.map((h) => (
        <tr key={h.id} className="bg-navy-800/50/50 text-xs">
          <td className="px-4 py-2 pl-10" colSpan={3}>
            <span className="text-navy-400">
              {new Date(h.scraped_at).toLocaleString()}
            </span>
          </td>
          <td className="px-4 py-2 text-center">
            {h.view_count?.toLocaleString() ?? "-"}
          </td>
          <td className="px-4 py-2 text-center">
            {h.like_count?.toLocaleString() ?? "-"}
          </td>
          <td className="px-4 py-2 text-center">
            {h.comment_count?.toLocaleString() ?? "-"}
          </td>
          <td className="px-4 py-2" colSpan={3}>
            {h.error_message && (
              <span className="text-red-500 text-xs">{h.error_message}</span>
            )}
          </td>
        </tr>
      ))}
    </>
  );
}

function getReviewForPlatform(
  sub: SubmissionWithViews,
  platformDisplay: string,
): SubmissionReviewData | null {
  const platformKey = platformDisplay.toLowerCase();
  return (
    sub.reviews?.find(
      (r) => (r.platform || "").toLowerCase() === platformKey,
    ) ||
    sub.reviews?.[0] ||
    null
  );
}

function calculatePayout(views: number | null, rpm: number): number {
  if (views === null || views === 0) return 0;
  return Math.round((views / 1000) * rpm * 100) / 100;
}

export default function ViewBotSubmissions({
  submissions,
  isLoading,
  filters,
  onFilterChange,
  onCheckNow,
  onPay,
  projects,
  checkingId,
  payingId,
}: ViewBotSubmissionsProps) {
  const { t } = useI18n();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function getVideoUrls(
    sub: SubmissionWithViews,
  ): { platform: string; url: string }[] {
    const urls: { platform: string; url: string }[] = [];
    if (sub.platform_links) {
      for (const [key, url] of Object.entries(sub.platform_links)) {
        if (typeof url === "string" && url.trim()) {
          try {
            const hostname = new URL(url).hostname.toLowerCase();
            if (hostname.includes("tiktok.com"))
              urls.push({ platform: "TikTok", url });
            else if (hostname.includes("instagram.com"))
              urls.push({ platform: "Instagram", url });
            else urls.push({ platform: key, url });
          } catch {
            urls.push({ platform: key, url });
          }
        }
      }
    }
    if (sub.video_url && !urls.some((u) => u.url === sub.video_url)) {
      urls.push({ platform: "Video", url: sub.video_url });
    }
    return urls;
  }

  function getLatestViews(
    sub: SubmissionWithViews,
    platform: string,
  ): number | null {
    const key = platform.toLowerCase();
    return sub.latest_views?.[key]?.view_count ?? null;
  }

  function getLatestLikes(
    sub: SubmissionWithViews,
    platform: string,
  ): number | null {
    const key = platform.toLowerCase();
    return sub.latest_views?.[key]?.like_count ?? null;
  }

  function getLatestComments(
    sub: SubmissionWithViews,
    platform: string,
  ): number | null {
    const key = platform.toLowerCase();
    return sub.latest_views?.[key]?.comment_count ?? null;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filters.projectId || ""}
          onChange={(e) =>
            onFilterChange({ ...filters, projectId: e.target.value || null })
          }
          className="px-3 py-2 border border-navy-700 rounded-lg text-sm bg-navy-900/50 text-gray-100"
        >
          <option value="">{t("viewBot.allProjects")}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>

        <select
          value={filters.platform || ""}
          onChange={(e) =>
            onFilterChange({
              ...filters,
              platform: (e.target.value as Platform) || null,
            })
          }
          className="px-3 py-2 border border-navy-700 rounded-lg text-sm bg-navy-900/50 text-gray-100"
        >
          <option value="">{t("viewBot.allPlatforms")}</option>
          <option value="tiktok">TikTok</option>
          <option value="instagram">Instagram</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-navy-900/50 rounded-xl border border-navy-800/60 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">
            {t("common.loading")}
          </div>
        ) : submissions.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            {t("viewBot.noSubmissions")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-gray-100">
              <thead className="bg-navy-800/50 text-navy-400">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">
                    {t("viewBot.student")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    {t("viewBot.project")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    {t("viewBot.videoUrl")}
                  </th>
                  <th className="px-4 py-3 text-center font-medium">
                    {t("viewBot.views")}
                  </th>
                  <th className="px-4 py-3 text-center font-medium">
                    {t("viewBot.likes")}
                  </th>
                  <th className="px-4 py-3 text-center font-medium">
                    {t("viewBot.comments")}
                  </th>
                  <th className="px-4 py-3 text-center font-medium">
                    {t("viewBot.rpm")}
                  </th>
                  <th className="px-4 py-3 text-center font-medium">
                    {t("viewBot.payout")}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    {t("viewBot.actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800/40">
                {submissions.map((sub) => {
                  const urls = getVideoUrls(sub);
                  const isExpanded = expandedId === sub.id;

                  return (
                    <React.Fragment key={sub.id}>
                      {urls.map((urlInfo, idx) => {
                        const review = getReviewForPlatform(
                          sub,
                          urlInfo.platform,
                        );
                        const views = getLatestViews(sub, urlInfo.platform);
                        const rpm = review
                          ? parseFloat(String(review.payment_amount)) || 0
                          : 0;
                        const payout = calculatePayout(views, rpm);
                        const isPaid = !!review?.paid_at;
                        const isPaying = payingId === review?.id;

                        return (
                          <tr
                            key={`${sub.id}-${idx}`}
                            className="hover:bg-emerald-500/25 cursor-pointer"
                            onClick={() =>
                              setExpandedId(isExpanded ? null : sub.id)
                            }
                          >
                            {idx === 0 && (
                              <>
                                <td className="px-4 py-3" rowSpan={urls.length}>
                                  <div className="font-medium text-gray-100">
                                    {sub.username}
                                  </div>
                                </td>
                                <td className="px-4 py-3" rowSpan={urls.length}>
                                  <div className="text-navy-800">
                                    {sub.project_title}
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    {sub.course_title}
                                  </div>
                                </td>
                              </>
                            )}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                                    urlInfo.platform === "TikTok"
                                      ? "bg-navy-700 text-gray-100"
                                      : urlInfo.platform === "Instagram"
                                        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                                        : urlInfo.platform === "YouTube"
                                          ? "bg-red-600 text-white"
                                          : urlInfo.platform === "Facebook"
                                            ? "bg-blue-600 text-white"
                                            : "bg-navy-800/80 text-navy-300"
                                  }`}
                                >
                                  {urlInfo.platform}
                                </span>
                                <a
                                  href={urlInfo.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-blue-600 hover:underline truncate max-w-[200px] block"
                                >
                                  {urlInfo.url}
                                </a>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center font-medium">
                              {views?.toLocaleString() ?? "-"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {getLatestLikes(
                                sub,
                                urlInfo.platform,
                              )?.toLocaleString() ?? "-"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {getLatestComments(
                                sub,
                                urlInfo.platform,
                              )?.toLocaleString() ?? "-"}
                            </td>
                            {/* RPM column */}
                            <td className="px-4 py-3 text-center">
                              {rpm > 0 ? (
                                <span className="text-emerald-600 font-medium">
                                  ₾{rpm.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            {/* Payout column */}
                            <td className="px-4 py-3 text-center">
                              {views === null ? (
                                <span className="text-gray-400 text-xs">
                                  {t("viewBot.notScraped")}
                                </span>
                              ) : payout > 0 ? (
                                <span className="text-gray-100 font-semibold">
                                  ₾{payout.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-gray-400">₾0.00</span>
                              )}
                            </td>
                            {/* Actions column */}
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {idx === 0 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onCheckNow(sub.id);
                                    }}
                                    disabled={checkingId === sub.id}
                                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                                      checkingId === sub.id
                                        ? "bg-navy-800/80 text-gray-400 cursor-not-allowed"
                                        : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                    }`}
                                  >
                                    {checkingId === sub.id
                                      ? t("viewBot.checking")
                                      : t("viewBot.checkNow")}
                                  </button>
                                )}
                                {review && !isPaid && payout > 0 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onPay(
                                        sub.id,
                                        review.id,
                                        payout,
                                        sub.username,
                                      );
                                    }}
                                    disabled={isPaying}
                                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                                      isPaying
                                        ? "bg-navy-800/80 text-gray-400 cursor-not-allowed"
                                        : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                    }`}
                                  >
                                    {isPaying
                                      ? t("viewBot.paying")
                                      : `${t("viewBot.pay")} ₾${payout.toFixed(2)}`}
                                  </button>
                                )}
                                {isPaid && (
                                  <span className="px-3 py-1.5 rounded text-xs font-medium bg-green-100 text-green-700">
                                    {t("viewBot.paid")}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {isExpanded && <HistoryRow submissionId={sub.id} />}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
