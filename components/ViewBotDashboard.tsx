"use client";

import React, { useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import type {
  ViewScrapeRun,
  ViewScraperProgress,
  ViewScrapeResultEnriched,
} from "@/types/view-scraper";
import type { ViewScraperSchedule } from "@/hooks/useViewScraperSchedule";

interface ViewBotDashboardProps {
  runs: ViewScrapeRun[];
  isRunning: boolean;
  isLoading: boolean;
  progress: ViewScraperProgress;
  isLiveActive: boolean;
  totalLinks: number;
  tiktokLinks: number;
  instagramLinks: number;
  onRunBot: () => void;
  schedule: ViewScraperSchedule | null;
  scheduleLoading: boolean;
  onUpdateSchedule: (cron: string) => Promise<boolean>;
  onToggleActive: (active: boolean) => Promise<boolean>;
  lastRunResults: ViewScrapeResultEnriched[];
  lastRunResultsLoading: boolean;
  latestCompletedRun: ViewScrapeRun | null;
}

const SCHEDULE_PRESETS = [
  { label: "daily3am", cron: "0 3 * * *" },
  { label: "daily9am", cron: "0 9 * * *" },
  { label: "every12h", cron: "0 3,15 * * *" },
  { label: "every6h", cron: "0 0,6,12,18 * * *" },
  { label: "weeklyMon", cron: "0 3 * * 1" },
];

const COLLAPSED_LIMIT = 5;

function cronToHuman(cron: string, t: (key: string) => string): string {
  for (const preset of SCHEDULE_PRESETS) {
    if (preset.cron === cron) return t(`viewBot.preset_${preset.label}`);
  }
  const parts = cron.split(/\s+/);
  if (parts.length !== 5) return cron;
  const [min, hour, dom, mon, dow] = parts;
  if (dom === "*" && mon === "*" && dow === "*") {
    if (hour.includes(","))
      return `${t("viewBot.everyDayAt")} ${hour
        .split(",")
        .map((h) => `${h}:${min.padStart(2, "0")}`)
        .join(", ")} UTC`;
    return `${t("viewBot.everyDayAt")} ${hour}:${min.padStart(2, "0")} UTC`;
  }
  return cron;
}

export default function ViewBotDashboard({
  runs,
  isRunning,
  isLoading,
  progress,
  isLiveActive,
  totalLinks,
  tiktokLinks,
  instagramLinks,
  onRunBot,
  schedule,
  scheduleLoading,
  onUpdateSchedule,
  onToggleActive,
  lastRunResults,
  lastRunResultsLoading,
  latestCompletedRun,
}: ViewBotDashboardProps) {
  const { t } = useI18n();
  const [customCron, setCustomCron] = useState("");
  const [scheduleUpdating, setScheduleUpdating] = useState(false);
  const [showAllRuns, setShowAllRuns] = useState(false);
  const [showAllResults, setShowAllResults] = useState(false);

  const lastRun = runs[0] || null;
  const progressPercent =
    progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;
  const displayedRuns = showAllRuns ? runs : runs.slice(0, COLLAPSED_LIMIT);
  const displayedResults = showAllResults
    ? lastRunResults
    : lastRunResults.slice(0, COLLAPSED_LIMIT);

  function formatDuration(run: ViewScrapeRun): string {
    if (!run.completed_at) return "In progress...";
    const start = new Date(run.started_at).getTime();
    const end = new Date(run.completed_at).getTime();
    const seconds = Math.round((end - start) / 1000);
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString();
  }

  function truncateUrl(url: string, maxLen = 40): string {
    if (url.length <= maxLen) return url;
    return url.slice(0, maxLen) + "...";
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-navy-900/50 rounded-xl border border-navy-800/60 p-5">
          <p className="text-sm text-navy-400">{t("viewBot.totalLinks")}</p>
          <p className="text-2xl font-bold text-gray-100 mt-1">
            {totalLinks.toLocaleString()}
          </p>
        </div>
        <div className="bg-navy-900/50 rounded-xl border border-navy-800/60 p-5">
          <p className="text-sm text-navy-400">{t("viewBot.tiktokLinks")}</p>
          <p className="text-2xl font-bold text-gray-100 mt-1">
            {tiktokLinks.toLocaleString()}
          </p>
        </div>
        <div className="bg-navy-900/50 rounded-xl border border-navy-800/60 p-5">
          <p className="text-sm text-navy-400">{t("viewBot.instagramLinks")}</p>
          <p className="text-2xl font-bold text-gray-100 mt-1">
            {instagramLinks.toLocaleString()}
          </p>
        </div>
        <div className="bg-navy-900/50 rounded-xl border border-navy-800/60 p-5">
          <p className="text-sm text-navy-400">{t("viewBot.lastRun")}</p>
          <p className="text-sm font-semibold text-gray-100 mt-1">
            {lastRun ? formatDate(lastRun.started_at) : t("viewBot.never")}
          </p>
        </div>
      </div>

      {/* Schedule Settings */}
      <div className="bg-navy-900/50 rounded-xl border border-navy-800/60 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-100">
            {t("viewBot.scheduleSettings")}
          </h3>
          {scheduleLoading ? (
            <span className="text-sm text-gray-400">{t("common.loading")}</span>
          ) : schedule ? (
            <button
              onClick={async () => {
                setScheduleUpdating(true);
                await onToggleActive(!schedule.active);
                setScheduleUpdating(false);
              }}
              disabled={scheduleUpdating}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                schedule.active ? "bg-emerald-500" : "bg-navy-700"
              } ${scheduleUpdating ? "opacity-50" : ""}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-navy-900/50 transition-transform ${
                  schedule.active ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          ) : null}
        </div>

        {schedule && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span
                className={`inline-block px-2.5 py-0.5 rounded text-xs font-medium ${
                  schedule.active
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-navy-800/50 text-navy-400"
                }`}
              >
                {schedule.active ? t("viewBot.active") : t("viewBot.paused")}
              </span>
              {schedule.schedule && (
                <span className="text-sm text-navy-400">
                  {cronToHuman(schedule.schedule, t)}
                </span>
              )}
            </div>

            {/* Preset buttons */}
            <div className="flex flex-wrap gap-2">
              {SCHEDULE_PRESETS.map((preset) => (
                <button
                  key={preset.cron}
                  onClick={async () => {
                    setScheduleUpdating(true);
                    await onUpdateSchedule(preset.cron);
                    setScheduleUpdating(false);
                  }}
                  disabled={scheduleUpdating}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    schedule.schedule === preset.cron
                      ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                      : "bg-navy-800/50 text-navy-400 hover:bg-emerald-500/25 border border-transparent"
                  } ${scheduleUpdating ? "opacity-50" : ""}`}
                >
                  {t(`viewBot.preset_${preset.label}`)}
                </button>
              ))}
            </div>

            {/* Custom cron input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customCron}
                onChange={(e) => setCustomCron(e.target.value)}
                placeholder={t("viewBot.customCronPlaceholder")}
                className="flex-1 px-3 py-1.5 text-sm border border-navy-800/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300"
              />
              <button
                onClick={async () => {
                  if (!customCron.trim()) return;
                  setScheduleUpdating(true);
                  const ok = await onUpdateSchedule(customCron.trim());
                  if (ok) setCustomCron("");
                  setScheduleUpdating(false);
                }}
                disabled={scheduleUpdating || !customCron.trim()}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  customCron.trim() && !scheduleUpdating
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-navy-800/80 text-gray-400 cursor-not-allowed"
                }`}
              >
                {t("viewBot.apply")}
              </button>
            </div>
          </div>
        )}

        {!schedule && !scheduleLoading && (
          <p className="text-sm text-gray-400">{t("viewBot.noSchedule")}</p>
        )}
      </div>

      {/* Run Button + Progress */}
      <div className="bg-navy-900/50 rounded-xl border border-navy-800/60 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-100">
            {t("viewBot.scrapeControl")}
          </h3>
          <button
            onClick={onRunBot}
            disabled={isRunning}
            className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
              isRunning
                ? "bg-navy-800/50 text-navy-500 cursor-not-allowed"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
          >
            {isRunning ? t("viewBot.running") : t("viewBot.runBotNow")}
          </button>
        </div>

        {isLiveActive && progress.total > 0 && (
          <div className="space-y-2">
            <div className="w-full bg-navy-800/80 rounded-full h-3">
              <div
                className="bg-emerald-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-navy-400">
              <span>
                {progress.completed} / {progress.total}{" "}
                {t("viewBot.urlsChecked")}
              </span>
              <span>{progressPercent}%</span>
            </div>
            {progress.lastUrl && (
              <p className="text-xs text-gray-400 truncate">
                {t("viewBot.lastChecked")}: {progress.lastUrl}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Recent Runs Table */}
      <div className="bg-navy-900/50 rounded-xl border border-navy-800/60 overflow-hidden">
        <div className="p-5 border-b border-navy-800/40">
          <h3 className="text-lg font-semibold text-gray-100">
            {t("viewBot.recentRuns")}
          </h3>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-400">
            {t("common.loading")}
          </div>
        ) : runs.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            {t("viewBot.noRuns")}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-gray-100">
                <thead className="bg-navy-800/50 text-navy-400">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">
                      {t("viewBot.triggeredBy")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      {t("viewBot.type")}
                    </th>
                    <th className="px-4 py-3 text-center font-medium">
                      {t("viewBot.urlsCheckedCol")}
                    </th>
                    <th className="px-4 py-3 text-center font-medium">
                      {t("viewBot.successCol")}
                    </th>
                    <th className="px-4 py-3 text-center font-medium">
                      {t("viewBot.failedCol")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      {t("viewBot.duration")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      {t("viewBot.statusCol")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-800/40">
                  {displayedRuns.map((run) => (
                    <tr key={run.id} className="hover:bg-emerald-500/25">
                      <td className="px-4 py-3">
                        {run.triggered_by_username ||
                          (run.trigger_type === "scheduled"
                            ? "System"
                            : "Unknown")}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            run.trigger_type === "scheduled"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-purple-100 text-purple-700"
                          }`}
                        >
                          {run.trigger_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {run.total_urls}
                      </td>
                      <td className="px-4 py-3 text-center text-emerald-600 font-medium">
                        {run.successful}
                      </td>
                      <td className="px-4 py-3 text-center text-red-600 font-medium">
                        {run.failed}
                      </td>
                      <td className="px-4 py-3">{formatDuration(run)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            run.status === "completed"
                              ? "bg-emerald-100 text-emerald-700"
                              : run.status === "running"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                          }`}
                        >
                          {run.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {runs.length > COLLAPSED_LIMIT && (
              <div className="p-3 border-t border-navy-800/40 text-center">
                <button
                  onClick={() => setShowAllRuns(!showAllRuns)}
                  className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  {showAllRuns
                    ? t("viewBot.showLess")
                    : `${t("viewBot.showAll")} (${runs.length})`}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Last Run Results */}
      <div className="bg-navy-900/50 rounded-xl border border-navy-800/60 overflow-hidden">
        <div className="p-5 border-b border-navy-800/40">
          <h3 className="text-lg font-semibold text-gray-100">
            {t("viewBot.lastRunResults")}
          </h3>
        </div>

        {lastRunResultsLoading ? (
          <div className="p-8 text-center text-gray-400">
            {t("common.loading")}
          </div>
        ) : lastRunResults.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            {t("viewBot.noResults")}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-gray-100">
                <thead className="bg-navy-800/50 text-navy-400">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">
                      {t("viewBot.platform")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      {t("viewBot.user")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      {t("viewBot.course")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      {t("viewBot.link")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      {t("viewBot.runtime")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      {t("viewBot.autoManual")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      {t("viewBot.date")}
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      {t("viewBot.views")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-800/40">
                  {displayedResults.map((result) => (
                    <tr key={result.id} className="hover:bg-emerald-500/25">
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            result.platform === "tiktok"
                              ? "bg-pink-100 text-pink-700"
                              : result.platform === "instagram"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-navy-800/80 text-navy-300"
                          }`}
                        >
                          {result.platform === "tiktok"
                            ? "TikTok"
                            : result.platform === "instagram"
                              ? "Instagram"
                              : result.platform}
                        </span>
                      </td>
                      <td className="px-4 py-3">{result.username}</td>
                      <td className="px-4 py-3">{result.course_title}</td>
                      <td className="px-4 py-3">
                        <a
                          href={result.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-600 hover:text-emerald-700 hover:underline"
                          title={result.video_url}
                        >
                          {truncateUrl(result.video_url)}
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        {latestCompletedRun
                          ? formatDuration(latestCompletedRun)
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            latestCompletedRun?.trigger_type === "scheduled"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-purple-100 text-purple-700"
                          }`}
                        >
                          {latestCompletedRun?.trigger_type === "scheduled"
                            ? t("viewBot.automatic")
                            : t("viewBot.manual_label")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-navy-400">
                        {result.scraped_at
                          ? new Date(result.scraped_at).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {result.view_count !== null
                          ? result.view_count.toLocaleString()
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {lastRunResults.length > COLLAPSED_LIMIT && (
              <div className="p-3 border-t border-navy-800/40 text-center">
                <button
                  onClick={() => setShowAllResults(!showAllResults)}
                  className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  {showAllResults
                    ? t("viewBot.showLess")
                    : `${t("viewBot.showAll")} (${lastRunResults.length})`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
