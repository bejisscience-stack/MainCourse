'use client';

import { useMemo } from 'react';
import type { EnrollmentWizardData } from '../EnrollmentWizard';
import { useI18n } from '@/contexts/I18nContext';
import { formatPriceInGel } from '@/lib/currency';

interface EnrollmentStepOverviewProps {
  course: EnrollmentWizardData['course'];
  data: EnrollmentWizardData;
  updateData: (updates: Partial<EnrollmentWizardData>) => void;
}

export default function EnrollmentStepOverview({
  course,
}: EnrollmentStepOverviewProps) {
  const { t } = useI18n();

  const formattedPrice = useMemo(() => formatPriceInGel(course.price), [course.price]);
  const formattedOriginalPrice = useMemo(() =>
    course.original_price ? formatPriceInGel(course.original_price) : null,
    [course.original_price]
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div>
        <h3 className="text-2xl font-bold text-charcoal-950 dark:text-white mb-2">
          {t('enrollment.stepOverviewTitle')}
        </h3>
        <p className="text-charcoal-600 dark:text-gray-400">
          {t('enrollment.stepOverviewDescription')}
        </p>
      </div>

      {/* Course Information Card */}
      <div className="bg-white/50 dark:bg-navy-800/50 rounded-2xl p-6 md:p-8 space-y-6 border border-charcoal-100/50 dark:border-navy-700/50 shadow-soft">
        <div>
          <h4 className="text-xl md:text-2xl font-bold text-charcoal-950 dark:text-white mb-3">
            {course.title}
          </h4>
          {course.description && (
            <p className="text-base text-charcoal-600 dark:text-gray-400 leading-relaxed">
              {course.description}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-charcoal-100/50 dark:border-navy-700/50">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-charcoal-500 dark:text-gray-400 mb-2">
              {t('payment.creator')}
            </p>
            <p className="text-lg font-semibold text-charcoal-950 dark:text-white flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-800/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-sm">
                {course.creator.charAt(0)}
              </span>
              {course.creator}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-charcoal-500 dark:text-gray-400 mb-2">
              {t('payment.price')}
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-charcoal-950 dark:text-white tracking-tight">
                {formattedPrice}
              </p>
              {formattedOriginalPrice && (
                <p className="text-lg line-through text-charcoal-400 dark:text-gray-500">
                  {formattedOriginalPrice}
                </p>
              )}
            </div>
          </div>
        </div>

        {course.course_type && (
          <div className="pt-6 border-t border-charcoal-100/50 dark:border-navy-700/50">
            <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-charcoal-50 dark:bg-navy-700 border border-charcoal-100 dark:border-navy-600 text-charcoal-700 dark:text-gray-300 rounded-full text-sm font-semibold">
              {course.course_type === 'Editing' && '🎬'}
              {course.course_type === 'Content Creation' && '📱'}
              {course.course_type === 'Website Creation' && '💻'}
              {course.course_type}
            </span>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/50 rounded-2xl p-5">
        <div className="flex items-start space-x-3">
          <svg
            className="w-6 h-6 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <p className="text-base font-semibold text-blue-800 dark:text-blue-300">
              {t('enrollment.overviewInfoTitle')}
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
              {t('enrollment.overviewInfoDescription')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}



