'use client';

import { memo, useMemo } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { formatPriceInGel } from '@/lib/currency';
import type { ActiveProject } from '@/hooks/useActiveProjects';
import { useProjectCountdown } from '@/hooks/useProjectCountdown';
import { useProjectBudget } from '@/hooks/useProjectBudget';

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

  // Countdown timer hook
  const countdown = useProjectCountdown(project.start_date, project.end_date);

  // Budget progress hook
  const budget = useProjectBudget(project.id, project.budget);

  // Format dates for display
  const formattedDates = useMemo(() => {
    const formatDate = (dateStr: string | null | undefined) => {
      if (!dateStr) return null;
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    };

    const start = formatDate(project.start_date);
    const end = formatDate(project.end_date);

    if (!start && !end) return t('activeProjects.noDatesSet') || 'No dates set';
    if (!start) return `Until ${end}`;
    if (!end) return `From ${start}`;
    return `${start} - ${end}`;
  }, [project.start_date, project.end_date, t]);

  // Format budget as currency (GEL)
  const formattedBudget = useMemo(() => {
    const formatted = formatPriceInGel(project.budget);
    // Remove decimal part for cleaner display
    return formatted.replace(/\.00$/, '').replace(/,00$/, '');
  }, [project.budget]);

  // Format remaining budget (GEL)
  const formattedRemainingBudget = useMemo(() => {
    const formatted = formatPriceInGel(budget.remainingBudget);
    // Remove decimal part for cleaner display
    return formatted.replace(/\.00$/, '').replace(/,00$/, '');
  }, [budget.remainingBudget]);

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

  // Determine if project is expired
  const isExpired = countdown.isExpired;

  // Budget progress bar color based on status
  const budgetBarColor = useMemo(() => {
    switch (budget.status) {
      case 'depleted':
        return 'bg-gray-400 dark:bg-gray-600';
      case 'critical':
        return 'bg-red-500 dark:bg-red-600';
      case 'low':
        return 'bg-amber-500 dark:bg-amber-600';
      case 'healthy':
      default:
        return 'bg-emerald-500 dark:bg-emerald-600';
    }
  }, [budget.status]);

  // Countdown badge color
  const countdownBadgeStyle = useMemo(() => {
    if (isExpired) {
      return 'bg-gray-500 dark:bg-gray-600 text-white';
    }
    if (countdown.timeRemaining.days <= 1) {
      return 'bg-red-500 dark:bg-red-600 text-white';
    }
    if (countdown.timeRemaining.days <= 3) {
      return 'bg-amber-500 dark:bg-amber-600 text-white';
    }
    return 'bg-emerald-500 dark:bg-emerald-600 text-white';
  }, [isExpired, countdown.timeRemaining.days]);

  // Handle card click - prevent if expired
  const handleClick = () => {
    if (!isExpired && onClick) {
      onClick();
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`h-full flex flex-col bg-gradient-to-br from-white to-gray-50 dark:from-navy-800 dark:to-navy-900 rounded-2xl overflow-hidden shadow-soft transition-all duration-300 border border-charcoal-100/50 dark:border-navy-700/50 ${
        isExpired
          ? 'opacity-60 grayscale cursor-not-allowed'
          : 'hover:shadow-xl hover:shadow-emerald-500/10 dark:hover:shadow-emerald-500/20 hover:scale-[1.02] hover:-translate-y-1 cursor-pointer'
      }`}
      style={{ transformOrigin: 'center', backfaceVisibility: 'hidden' }}
    >
      {/* Header Section with Thumbnail */}
      <div className="relative w-full h-28 bg-gradient-to-br from-emerald-50 via-white to-charcoal-50/30 dark:from-emerald-500/10 dark:via-navy-800 dark:to-navy-700/30 overflow-hidden">
        {project.course_thumbnail_url ? (
          <img
            src={project.course_thumbnail_url}
            alt={project.course_title}
            className={`w-full h-full object-cover ${isExpired ? 'grayscale' : ''}`}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-full h-full bg-gradient-to-br from-emerald-50/60 via-white/80 to-charcoal-50/40 dark:from-emerald-500/20 dark:via-navy-700/50 dark:to-navy-800/50">
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-8 h-8 text-emerald-500/50 dark:text-emerald-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* Expired Badge - Top Left */}
        {isExpired && (
          <div className="absolute top-2 left-2 bg-gray-700 dark:bg-gray-800 text-white px-2.5 py-1 rounded-md shadow-md z-10">
            <span className="text-xs font-bold uppercase tracking-wide">{t('activeProjects.expired') || 'Expired'}</span>
          </div>
        )}

        {/* Countdown Badge - Top Right */}
        {countdown.formattedTime && (
          <div className={`absolute top-2 right-2 ${countdownBadgeStyle} px-2.5 py-1 rounded-md shadow-md z-10 flex items-center gap-1.5`}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-semibold">{countdown.formattedTime}</span>
          </div>
        )}

        {/* Course Badge - Bottom Left */}
        <div className="absolute bottom-2 left-2 bg-white/90 dark:bg-navy-800/90 backdrop-blur-sm px-2 py-0.5 rounded-full flex items-center space-x-1.5 border border-charcoal-100/50 dark:border-navy-700/50 z-10 shadow-soft max-w-[70%]">
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
      <div className="flex-1 flex flex-col p-4">
        <div className="flex-1 space-y-2.5">
          {/* Project Name */}
          <h3 className={`text-sm font-semibold line-clamp-2 leading-snug ${
            isExpired ? 'text-charcoal-500 dark:text-gray-500' : 'text-charcoal-950 dark:text-white'
          }`}>
            {project.name}
          </h3>

          {/* Lecturer */}
          <p className="text-xs text-charcoal-500 dark:text-gray-400 flex items-center">
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {lecturerName}
          </p>

          {/* Date Range */}
          <div className="flex items-center text-xs text-charcoal-500 dark:text-gray-400">
            <svg className="w-3 h-3 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="truncate">{formattedDates}</span>
          </div>

          {/* Platforms */}
          <div className="flex flex-wrap gap-1">
            {project.platforms.map((platform) => {
              const config = platformConfig[platform.toLowerCase()] || {
                icon: '•',
                bgColor: 'bg-gray-100 dark:bg-gray-700',
                textColor: 'text-gray-600 dark:text-gray-300',
              };
              return (
                <span
                  key={platform}
                  className={`${config.bgColor} ${config.textColor} text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center space-x-0.5 ${
                    isExpired ? 'opacity-60' : ''
                  }`}
                >
                  <span>{config.icon}</span>
                  <span className="capitalize">{platform}</span>
                </span>
              );
            })}
          </div>

          {/* View Range */}
          <div className="flex items-center text-xs text-charcoal-500 dark:text-gray-400">
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span>{formattedViewRange} {t('activeProjects.views')}</span>
          </div>
        </div>

        {/* Budget Progress Section */}
        <div className="mt-3 pt-3 border-t border-charcoal-100/50 dark:border-navy-700/50">
          <div className="space-y-2">
            {/* Budget Header */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-charcoal-600 dark:text-gray-300">
                {t('activeProjects.budget') || 'Budget'}
              </span>
              <span className={`text-xs font-bold ${
                budget.status === 'depleted' ? 'text-gray-500' :
                budget.status === 'critical' ? 'text-red-500 dark:text-red-400' :
                budget.status === 'low' ? 'text-amber-500 dark:text-amber-400' :
                'text-emerald-600 dark:text-emerald-400'
              }`}>
                {budget.isLoading ? '...' : `${formattedRemainingBudget} / ${formattedBudget}`}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-charcoal-100 dark:bg-navy-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${budgetBarColor}`}
                style={{ width: `${budget.percentageRemaining}%` }}
              />
            </div>

            {/* Budget Status Text */}
            {!budget.isLoading && budget.totalSpent > 0 && (
              <p className="text-[10px] text-charcoal-400 dark:text-gray-500">
                {budget.status === 'depleted'
                  ? t('activeProjects.budgetDepleted') || 'Budget depleted'
                  : `${Math.round(budget.percentageRemaining)}% ${t('activeProjects.remaining') || 'remaining'}`
                }
              </p>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-3">
          <button
            disabled={isExpired}
            className={`w-full inline-flex items-center justify-center px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 ${
              isExpired
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                : 'text-white bg-charcoal-950 dark:bg-emerald-500 hover:bg-charcoal-800 dark:hover:bg-emerald-600 hover:shadow-soft dark:hover:shadow-glow-dark'
            }`}
          >
            {isExpired ? (
              <>
                <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                {t('activeProjects.projectExpired') || 'Project Expired'}
              </>
            ) : (
              <>
                <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                {t('activeProjects.viewDetails')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(ProjectCard);
