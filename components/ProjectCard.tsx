'use client';

import { memo, useMemo } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import type { ActiveProject } from '@/hooks/useActiveProjects';

// Platform icons/badges configuration
const platformConfig: Record<string, { icon: string; bgColor: string; textColor: string }> = {
  youtube: {
    icon: '▶',
    bgColor: 'bg-red-100 dark:bg-red-500/20',
    textColor: 'text-red-600 dark:text-red-400',
  },
  instagram: {
    icon: '📷',
    bgColor: 'bg-pink-100 dark:bg-pink-500/20',
    textColor: 'text-pink-600 dark:text-pink-400',
  },
  facebook: {
    icon: 'f',
    bgColor: 'bg-blue-100 dark:bg-blue-500/20',
    textColor: 'text-blue-600 dark:text-blue-400',
  },
  tiktok: {
    icon: '♪',
    bgColor: 'bg-slate-100 dark:bg-slate-500/20',
    textColor: 'text-slate-600 dark:text-slate-400',
  },
};

interface ProjectCardProps {
  project: ActiveProject;
  onClick?: () => void;
}

function ProjectCard({ project, onClick }: ProjectCardProps) {
  const { t } = useI18n();

  // Format budget as currency
  const formattedBudget = useMemo(() => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(project.budget);
  }, [project.budget]);

  // Format view range
  const formattedViewRange = useMemo(() => {
    const formatViews = (num: number) => {
      if (num >= 1000000) {
        return `${(num / 1000000).toFixed(1)}M`;
      }
      if (num >= 1000) {
        return `${(num / 1000).toFixed(0)}K`;
      }
      return num.toString();
    };
    return `${formatViews(project.min_views)} - ${formatViews(project.max_views)}`;
  }, [project.min_views, project.max_views]);

  // Get lecturer display name
  const lecturerName = project.lecturer_full_name || project.lecturer_username || t('activeProjects.unknownLecturer');

  return (
    <div
      onClick={onClick}
      className="h-full flex flex-col bg-white dark:bg-navy-800 rounded-3xl overflow-hidden shadow-soft hover:shadow-soft-lg dark:hover:shadow-glow-dark transition-all duration-200 border border-charcoal-100/50 dark:border-navy-700/50 hover:scale-[1.01] hover:-translate-y-0.5 will-change-transform cursor-pointer"
      style={{ transformOrigin: 'center', backfaceVisibility: 'hidden' }}
    >
      {/* Thumbnail Section */}
      <div className="relative w-full h-28 bg-gradient-to-br from-emerald-50 via-white to-charcoal-50/30 dark:from-emerald-500/10 dark:via-navy-800 dark:to-navy-700/30 overflow-hidden">
        {project.course_thumbnail_url ? (
          <img
            src={project.course_thumbnail_url}
            alt={project.course_title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-full h-full bg-gradient-to-br from-emerald-50/60 via-white/80 to-charcoal-50/40 dark:from-emerald-500/20 dark:via-navy-700/50 dark:to-navy-800/50 backdrop-blur-sm">
              {/* Decorative pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-2 left-2 w-16 h-16 border border-white/30 rounded-full blur-sm"></div>
                <div className="absolute bottom-2 right-2 w-12 h-12 border border-white/30 rounded-full blur-sm"></div>
              </div>
              {/* Project icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-10 h-10 text-emerald-500/50 dark:text-emerald-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* Budget Badge - Top right */}
        <div className="absolute top-2 right-2 bg-emerald-500 dark:bg-emerald-600 text-white px-3 py-1.5 rounded-lg shadow-md z-10">
          <span className="text-sm font-bold">{formattedBudget}</span>
        </div>

        {/* Course Badge - Bottom left */}
        <div className="absolute bottom-2 left-2 bg-white/90 dark:bg-navy-800/90 backdrop-blur-sm px-2 py-1 rounded-full flex items-center space-x-1.5 border border-charcoal-100/50 dark:border-navy-700/50 z-10 shadow-soft max-w-[70%]">
          <svg
            className="w-3 h-3 text-charcoal-600 dark:text-gray-300 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          <span className="text-charcoal-600 dark:text-gray-300 text-[10px] font-medium truncate">
            {project.course_title}
          </span>
        </div>
      </div>

      {/* Project Info Section */}
      <div className="flex-1 flex flex-col p-5">
        <div className="flex-1 space-y-3">
          {/* Project Name */}
          <h3 className="text-base font-semibold text-charcoal-950 dark:text-white line-clamp-2 leading-snug">
            {project.name}
          </h3>

          {/* Lecturer */}
          <p className="text-sm text-charcoal-500 dark:text-gray-400 flex items-center">
            <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {lecturerName}
          </p>

          {/* Platforms */}
          <div className="flex flex-wrap gap-1.5">
            {project.platforms.map((platform) => {
              const config = platformConfig[platform.toLowerCase()] || {
                icon: '•',
                bgColor: 'bg-gray-100 dark:bg-gray-700',
                textColor: 'text-gray-600 dark:text-gray-300',
              };
              return (
                <span
                  key={platform}
                  className={`${config.bgColor} ${config.textColor} text-[10px] font-semibold px-2 py-0.5 rounded-md flex items-center space-x-1`}
                >
                  <span>{config.icon}</span>
                  <span className="capitalize">{platform}</span>
                </span>
              );
            })}
          </div>

          {/* View Range */}
          <div className="flex items-center text-xs text-charcoal-500 dark:text-gray-400">
            <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span>{formattedViewRange} {t('activeProjects.views')}</span>
          </div>
        </div>

        {/* View Details Button */}
        <div className="mt-auto pt-3 border-t border-charcoal-100/50 dark:border-navy-700/50">
          <button
            className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-charcoal-950 dark:bg-emerald-500 rounded-full hover:bg-charcoal-800 dark:hover:bg-emerald-600 transition-all duration-200 hover:shadow-soft dark:hover:shadow-glow-dark hover:-translate-y-0.5 will-change-transform"
            style={{ transformOrigin: 'center', backfaceVisibility: 'hidden' }}
          >
            <svg
              className="w-3.5 h-3.5 mr-1.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            {t('activeProjects.viewDetails')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(ProjectCard);
