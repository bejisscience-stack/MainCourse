"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { supabase } from "@/lib/supabase";
import { useViewScraperRuns } from "@/hooks/useViewScraperRuns";
import { useViewScraperSubmissions } from "@/hooks/useViewScraperSubmissions";
import { useViewScraperLive } from "@/hooks/useViewScraperLive";
import { useViewScraperSchedule } from "@/hooks/useViewScraperSchedule";
import { useViewScraperRunResults } from "@/hooks/useViewScraperRunResults";
import ViewBotDashboard from "./ViewBotDashboard";
import ViewBotSubmissions from "./ViewBotSubmissions";
import ViewBotByProject from "./ViewBotByProject";
import type { Platform } from "@/types/view-scraper";

type SubTab = "dashboard" | "submissions" | "by-project";

export default function AdminViewBot() {
  const { t } = useI18n();
  const [subTab, setSubTab] = useState<SubTab>("dashboard");
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [checkingProjectId, setCheckingProjectId] = useState<string | null>(
    null,
  );
  const [isTriggering, setIsTriggering] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  const {
    runs,
    activeRun,
    isRunning,
    isLoading: runsLoading,
    triggerRun,
    triggerCheck,
    error: scraperError,
    clearError,
  } = useViewScraperRuns();
  const {
    submissions,
    allSubmissions,
    isLoading: subsLoading,
    filters,
    setFilters,
    mutate: mutateSubmissions,
  } = useViewScraperSubmissions();
  const { progress, isActive: isLiveActive } = useViewScraperLive(
    activeRun?.id || null,
  );
  const {
    schedule,
    isLoading: scheduleLoading,
    updateSchedule,
    toggleActive,
  } = useViewScraperSchedule();

  const latestCompletedRun = useMemo(
    () => runs.find((r) => r.status === "completed") || null,
    [runs],
  );
  const { results: lastRunResults, isLoading: lastRunResultsLoading } =
    useViewScraperRunResults(latestCompletedRun?.id || null);

  // Compute link counts
  const linkCounts = useMemo(() => {
    let total = 0;
    let tiktok = 0;
    let instagram = 0;

    const countPlatform = (hostname: string) => {
      if (hostname.includes("tiktok.com")) tiktok++;
      else if (hostname.includes("instagram.com")) instagram++;
    };

    for (const sub of allSubmissions) {
      if (sub.platform_links) {
        for (const [, url] of Object.entries(sub.platform_links)) {
          if (typeof url === "string" && url.trim()) {
            total++;
            try {
              countPlatform(new URL(url).hostname.toLowerCase());
            } catch {
              /* skip */
            }
          }
        }
      }
      if (sub.video_url) {
        const alreadyCounted = sub.platform_links
          ? Object.values(sub.platform_links).includes(sub.video_url)
          : false;
        if (!alreadyCounted) {
          total++;
          try {
            countPlatform(new URL(sub.video_url).hostname.toLowerCase());
          } catch {
            /* skip */
          }
        }
      }
    }

    return { total, tiktok, instagram };
  }, [allSubmissions]);

  // Unique projects for filter dropdown
  const uniqueProjects = useMemo(() => {
    const map = new Map<string, string>();
    for (const sub of allSubmissions) {
      if (!map.has(sub.project_id)) {
        map.set(sub.project_id, sub.project_title);
      }
    }
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [allSubmissions]);

  const handleRunBot = useCallback(async () => {
    setIsTriggering(true);
    try {
      await triggerRun();
    } finally {
      setIsTriggering(false);
    }
  }, [triggerRun]);

  const handleCheckNow = useCallback(
    async (submissionId: string) => {
      setCheckingId(submissionId);
      await triggerCheck(submissionId);
      setTimeout(() => setCheckingId(null), 3000);
    },
    [triggerCheck],
  );

  const handleCheckProject = useCallback(
    async (projectId: string) => {
      setCheckingProjectId(projectId);
      await triggerRun(projectId);
      setTimeout(() => setCheckingProjectId(null), 3000);
    },
    [triggerRun],
  );

  const handleViewSubmissions = useCallback(
    (projectId: string) => {
      setFilters({ projectId, platform: null });
      setSubTab("submissions");
    },
    [setFilters],
  );

  const handleFilterChange = useCallback(
    (newFilters: { projectId: string | null; platform: Platform | null }) => {
      setFilters(newFilters);
    },
    [setFilters],
  );

  const handlePay = useCallback(
    async (
      submissionId: string,
      reviewId: string,
      payoutAmount: number,
      studentName: string,
    ) => {
      if (!confirm(`Pay ₾${payoutAmount.toFixed(2)} to ${studentName}?`))
        return;

      setPayingId(reviewId);
      try {
        let {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          const {
            data: { session: refreshed },
          } = await supabase.auth.refreshSession();
          session = refreshed;
        }
        if (!session?.access_token) return;

        const response = await fetch(
          `/api/admin/submissions/${submissionId}/pay`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              review_id: reviewId,
              payout_amount: payoutAmount,
            }),
          },
        );

        if (!response.ok) {
          const data = await response.json();
          alert(data.error || "Payment failed");
          return;
        }

        // Refresh submissions list immediately
        await mutateSubmissions();
      } catch {
        alert("Payment failed. Please try again.");
      } finally {
        setPayingId(null);
      }
    },
    [mutateSubmissions],
  );

  // Auto-dismiss error after 8 seconds
  useEffect(() => {
    if (!scraperError) return;
    const timer = setTimeout(() => clearError(), 8000);
    return () => clearTimeout(timer);
  }, [scraperError, clearError]);

  return (
    <div className="space-y-6">
      {/* Error alert */}
      {scraperError && (
        <div
          className="flex items-center justify-between bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm cursor-pointer"
          onClick={clearError}
        >
          <span>{scraperError}</span>
          <span className="text-red-400 hover:text-red-600 ml-4 font-medium">
            &times;
          </span>
        </div>
      )}

      {/* Sub-tab navigation */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(["dashboard", "submissions", "by-project"] as SubTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              subTab === tab
                ? "bg-white text-navy-900 shadow-sm"
                : "text-gray-600 hover:text-navy-900"
            }`}
          >
            {tab === "dashboard" && t("viewBot.tabDashboard")}
            {tab === "submissions" && t("viewBot.tabSubmissions")}
            {tab === "by-project" && t("viewBot.tabByProject")}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {subTab === "dashboard" && (
        <ViewBotDashboard
          runs={runs}
          isRunning={isTriggering || isRunning}
          isLoading={runsLoading}
          progress={progress}
          isLiveActive={isLiveActive}
          totalLinks={linkCounts.total}
          tiktokLinks={linkCounts.tiktok}
          instagramLinks={linkCounts.instagram}
          onRunBot={handleRunBot}
          schedule={schedule}
          scheduleLoading={scheduleLoading}
          onUpdateSchedule={updateSchedule}
          onToggleActive={toggleActive}
          lastRunResults={lastRunResults}
          lastRunResultsLoading={lastRunResultsLoading}
          latestCompletedRun={latestCompletedRun}
        />
      )}

      {subTab === "submissions" && (
        <ViewBotSubmissions
          submissions={submissions}
          isLoading={subsLoading}
          filters={filters}
          onFilterChange={handleFilterChange}
          onCheckNow={handleCheckNow}
          onPay={handlePay}
          projects={uniqueProjects}
          checkingId={checkingId}
          payingId={payingId}
        />
      )}

      {subTab === "by-project" && (
        <ViewBotByProject
          submissions={allSubmissions}
          isLoading={subsLoading}
          onViewSubmissions={handleViewSubmissions}
          onCheckProject={handleCheckProject}
          checkingProjectId={checkingProjectId}
        />
      )}
    </div>
  );
}
