'use client';

import React, { useState } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { useSubmissionViewHistory } from '@/hooks/useSubmissionViewHistory';
import type { SubmissionWithViews, Platform } from '@/types/view-scraper';

interface ViewBotSubmissionsProps {
  submissions: SubmissionWithViews[];
  isLoading: boolean;
  filters: { projectId: string | null; platform: Platform | null };
  onFilterChange: (filters: { projectId: string | null; platform: Platform | null }) => void;
  onCheckNow: (submissionId: string) => void;
  projects: { id: string; title: string }[];
  checkingId: string | null;
}

function HistoryRow({ submissionId }: { submissionId: string }) {
  const { history, isLoading } = useSubmissionViewHistory(submissionId);
  const { t } = useI18n();

  if (isLoading) return <tr><td colSpan={7} className="px-4 py-3 text-center text-gray-400 text-sm">{t('common.loading')}</td></tr>;
  if (history.length === 0) return <tr><td colSpan={7} className="px-4 py-3 text-center text-gray-400 text-sm">{t('viewBot.noHistory')}</td></tr>;

  return (
    <>
      {history.map((h) => (
        <tr key={h.id} className="bg-gray-50/50 text-xs">
          <td className="px-4 py-2 pl-10" colSpan={3}>
            <span className="text-gray-500">{new Date(h.scraped_at).toLocaleString()}</span>
          </td>
          <td className="px-4 py-2 text-center">{h.view_count?.toLocaleString() ?? '-'}</td>
          <td className="px-4 py-2 text-center">{h.like_count?.toLocaleString() ?? '-'}</td>
          <td className="px-4 py-2 text-center">{h.comment_count?.toLocaleString() ?? '-'}</td>
          <td className="px-4 py-2">
            {h.error_message && (
              <span className="text-red-500 text-xs">{h.error_message}</span>
            )}
          </td>
        </tr>
      ))}
    </>
  );
}

export default function ViewBotSubmissions({
  submissions,
  isLoading,
  filters,
  onFilterChange,
  onCheckNow,
  projects,
  checkingId,
}: ViewBotSubmissionsProps) {
  const { t } = useI18n();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function getVideoUrls(sub: SubmissionWithViews): { platform: string; url: string }[] {
    const urls: { platform: string; url: string }[] = [];
    if (sub.platform_links) {
      for (const [key, url] of Object.entries(sub.platform_links)) {
        if (typeof url === 'string' && url.trim()) {
          try {
            const hostname = new URL(url).hostname.toLowerCase();
            if (hostname.includes('tiktok.com')) urls.push({ platform: 'TikTok', url });
            else if (hostname.includes('instagram.com')) urls.push({ platform: 'Instagram', url });
            else urls.push({ platform: key, url });
          } catch {
            urls.push({ platform: key, url });
          }
        }
      }
    }
    if (sub.video_url && !urls.some((u) => u.url === sub.video_url)) {
      urls.push({ platform: 'Video', url: sub.video_url });
    }
    return urls;
  }

  function getLatestViews(sub: SubmissionWithViews, platform: string): number | null {
    const key = platform.toLowerCase();
    return sub.latest_views?.[key]?.view_count ?? null;
  }

  function getLatestLikes(sub: SubmissionWithViews, platform: string): number | null {
    const key = platform.toLowerCase();
    return sub.latest_views?.[key]?.like_count ?? null;
  }

  function getLatestComments(sub: SubmissionWithViews, platform: string): number | null {
    const key = platform.toLowerCase();
    return sub.latest_views?.[key]?.comment_count ?? null;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filters.projectId || ''}
          onChange={(e) => onFilterChange({ ...filters, projectId: e.target.value || null })}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
        >
          <option value="">{t('viewBot.allProjects')}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>

        <select
          value={filters.platform || ''}
          onChange={(e) => onFilterChange({ ...filters, platform: (e.target.value as Platform) || null })}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
        >
          <option value="">{t('viewBot.allPlatforms')}</option>
          <option value="tiktok">TikTok</option>
          <option value="instagram">Instagram</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">{t('common.loading')}</div>
        ) : submissions.length === 0 ? (
          <div className="p-8 text-center text-gray-400">{t('viewBot.noSubmissions')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-gray-900">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">{t('viewBot.student')}</th>
                  <th className="px-4 py-3 text-left font-medium">{t('viewBot.project')}</th>
                  <th className="px-4 py-3 text-left font-medium">{t('viewBot.videoUrl')}</th>
                  <th className="px-4 py-3 text-center font-medium">{t('viewBot.views')}</th>
                  <th className="px-4 py-3 text-center font-medium">{t('viewBot.likes')}</th>
                  <th className="px-4 py-3 text-center font-medium">{t('viewBot.comments')}</th>
                  <th className="px-4 py-3 text-right font-medium">{t('viewBot.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {submissions.map((sub) => {
                  const urls = getVideoUrls(sub);
                  const isExpanded = expandedId === sub.id;

                  return (
                    <React.Fragment key={sub.id}>
                      {urls.map((urlInfo, idx) => (
                        <tr
                          key={`${sub.id}-${idx}`}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                        >
                          {idx === 0 && (
                            <>
                              <td className="px-4 py-3" rowSpan={urls.length}>
                                <div className="font-medium text-navy-900">{sub.username}</div>
                              </td>
                              <td className="px-4 py-3" rowSpan={urls.length}>
                                <div className="text-navy-800">{sub.project_title}</div>
                                <div className="text-xs text-gray-400">{sub.course_title}</div>
                              </td>
                            </>
                          )}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                                urlInfo.platform === 'TikTok' ? 'bg-gray-900 text-white'
                                  : urlInfo.platform === 'Instagram' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                                  : urlInfo.platform === 'YouTube' ? 'bg-red-600 text-white'
                                  : urlInfo.platform === 'Facebook' ? 'bg-blue-600 text-white'
                                  : 'bg-gray-200 text-gray-700'
                              }`}>
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
                            {getLatestViews(sub, urlInfo.platform)?.toLocaleString() ?? '-'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {getLatestLikes(sub, urlInfo.platform)?.toLocaleString() ?? '-'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {getLatestComments(sub, urlInfo.platform)?.toLocaleString() ?? '-'}
                          </td>
                          {idx === 0 && (
                            <td className="px-4 py-3 text-right" rowSpan={urls.length}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onCheckNow(sub.id);
                                }}
                                disabled={checkingId === sub.id}
                                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                                  checkingId === sub.id
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                }`}
                              >
                                {checkingId === sub.id ? t('viewBot.checking') : t('viewBot.checkNow')}
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
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
