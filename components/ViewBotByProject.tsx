'use client';

import React, { useMemo } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import type { SubmissionWithViews } from '@/types/view-scraper';

interface ProjectGroup {
  projectId: string;
  projectTitle: string;
  courseTitle: string;
  courseId: string;
  minViews: number | null;
  maxViews: number | null;
  platforms: string[] | null;
  submissionCount: number;
  avgViews: number;
  totalViews: number;
}

interface ViewBotByProjectProps {
  submissions: SubmissionWithViews[];
  isLoading: boolean;
  onViewSubmissions: (projectId: string) => void;
  onCheckProject: (projectId: string) => void;
  checkingProjectId: string | null;
}

export default function ViewBotByProject({
  submissions,
  isLoading,
  onViewSubmissions,
  onCheckProject,
  checkingProjectId,
}: ViewBotByProjectProps) {
  const { t } = useI18n();

  const projects = useMemo(() => {
    const map = new Map<string, ProjectGroup>();

    for (const sub of submissions) {
      if (!map.has(sub.project_id)) {
        map.set(sub.project_id, {
          projectId: sub.project_id,
          projectTitle: sub.project_title,
          courseTitle: sub.course_title,
          courseId: sub.course_id,
          minViews: sub.min_views,
          maxViews: sub.max_views,
          platforms: sub.platforms,
          submissionCount: 0,
          avgViews: 0,
          totalViews: 0,
        });
      }

      const group = map.get(sub.project_id)!;
      group.submissionCount++;

      // Sum up views from all platforms
      if (sub.latest_views) {
        for (const [, data] of Object.entries(sub.latest_views)) {
          if (data && typeof data === 'object' && 'view_count' in data && data.view_count) {
            group.totalViews += data.view_count;
          }
        }
      }
    }

    // Calculate averages
    for (const group of map.values()) {
      group.avgViews = group.submissionCount > 0
        ? Math.round(group.totalViews / group.submissionCount)
        : 0;
    }

    return Array.from(map.values()).sort((a, b) => b.submissionCount - a.submissionCount);
  }, [submissions]);

  if (isLoading) {
    return <div className="p-8 text-center text-gray-400">{t('common.loading')}</div>;
  }

  if (projects.length === 0) {
    return <div className="p-8 text-center text-gray-400">{t('viewBot.noProjects')}</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {projects.map((project) => (
        <div key={project.projectId} className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="mb-3">
            <h4 className="font-semibold text-navy-900 text-base">{project.projectTitle}</h4>
            <p className="text-sm text-gray-500">{project.courseTitle}</p>
          </div>

          <div className="space-y-2 mb-4">
            {project.minViews !== null && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t('viewBot.minViews')}:</span>
                <span className="font-medium">{project.minViews.toLocaleString()}</span>
              </div>
            )}
            {project.platforms && project.platforms.length > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t('viewBot.platformsLabel')}:</span>
                <div className="flex gap-1">
                  {project.platforms.map((p) => (
                    <span key={p} className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                      p.toLowerCase() === 'tiktok'
                        ? 'bg-gray-900 text-white'
                        : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                    }`}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('viewBot.submissionsCount')}:</span>
              <span className="font-medium">{project.submissionCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('viewBot.avgViews')}:</span>
              <span className="font-medium">{project.avgViews.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onViewSubmissions(project.projectId)}
              className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-navy-100 text-navy-700 hover:bg-navy-200 transition-colors"
            >
              {t('viewBot.viewSubmissions')}
            </button>
            <button
              onClick={() => onCheckProject(project.projectId)}
              disabled={checkingProjectId === project.projectId}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                checkingProjectId === project.projectId
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
              }`}
            >
              {checkingProjectId === project.projectId ? t('viewBot.checking') : t('viewBot.checkProject')}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
