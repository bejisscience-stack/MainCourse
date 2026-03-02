'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { useViewScraperRuns } from '@/hooks/useViewScraperRuns';
import { useViewScraperSubmissions } from '@/hooks/useViewScraperSubmissions';
import { useViewScraperLive } from '@/hooks/useViewScraperLive';
import { useViewScraperSchedule } from '@/hooks/useViewScraperSchedule';
import ViewBotDashboard from './ViewBotDashboard';
import ViewBotSubmissions from './ViewBotSubmissions';
import ViewBotByProject from './ViewBotByProject';
import type { Platform } from '@/types/view-scraper';

type SubTab = 'dashboard' | 'submissions' | 'by-project';

export default function AdminViewBot() {
  const { t } = useI18n();
  const [subTab, setSubTab] = useState<SubTab>('dashboard');
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [checkingProjectId, setCheckingProjectId] = useState<string | null>(null);

  const { runs, activeRun, isRunning, isLoading: runsLoading, triggerRun, triggerCheck } = useViewScraperRuns();
  const { submissions, allSubmissions, isLoading: subsLoading, filters, setFilters } = useViewScraperSubmissions();
  const { progress, isActive: isLiveActive } = useViewScraperLive(activeRun?.id || null);
  const { schedule, isLoading: scheduleLoading, updateSchedule, toggleActive } = useViewScraperSchedule();

  // Compute link counts
  const linkCounts = useMemo(() => {
    let total = 0;
    let tiktok = 0;
    let instagram = 0;

    for (const sub of allSubmissions) {
      if (sub.platform_links) {
        for (const [, url] of Object.entries(sub.platform_links)) {
          if (typeof url === 'string' && url.trim()) {
            total++;
            try {
              const hostname = new URL(url).hostname.toLowerCase();
              if (hostname.includes('tiktok.com')) tiktok++;
              else if (hostname.includes('instagram.com')) instagram++;
            } catch { /* skip */ }
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
            const hostname = new URL(sub.video_url).hostname.toLowerCase();
            if (hostname.includes('tiktok.com')) tiktok++;
            else if (hostname.includes('instagram.com')) instagram++;
          } catch { /* skip */ }
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
    await triggerRun();
  }, [triggerRun]);

  const handleCheckNow = useCallback(async (submissionId: string) => {
    setCheckingId(submissionId);
    await triggerCheck(submissionId);
    setTimeout(() => setCheckingId(null), 3000);
  }, [triggerCheck]);

  const handleCheckProject = useCallback(async (projectId: string) => {
    setCheckingProjectId(projectId);
    await triggerRun(projectId);
    setTimeout(() => setCheckingProjectId(null), 3000);
  }, [triggerRun]);

  const handleViewSubmissions = useCallback((projectId: string) => {
    setFilters({ projectId, platform: null });
    setSubTab('submissions');
  }, [setFilters]);

  const handleFilterChange = useCallback((newFilters: { projectId: string | null; platform: Platform | null }) => {
    setFilters(newFilters);
  }, [setFilters]);

  return (
    <div className="space-y-6">
      {/* Sub-tab navigation */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(['dashboard', 'submissions', 'by-project'] as SubTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              subTab === tab
                ? 'bg-white text-navy-900 shadow-sm'
                : 'text-gray-600 hover:text-navy-900'
            }`}
          >
            {tab === 'dashboard' && t('viewBot.tabDashboard')}
            {tab === 'submissions' && t('viewBot.tabSubmissions')}
            {tab === 'by-project' && t('viewBot.tabByProject')}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {subTab === 'dashboard' && (
        <ViewBotDashboard
          runs={runs}
          isRunning={isRunning}
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
        />
      )}

      {subTab === 'submissions' && (
        <ViewBotSubmissions
          submissions={submissions}
          isLoading={subsLoading}
          filters={filters}
          onFilterChange={handleFilterChange}
          onCheckNow={handleCheckNow}
          projects={uniqueProjects}
          checkingId={checkingId}
        />
      )}

      {subTab === 'by-project' && (
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
