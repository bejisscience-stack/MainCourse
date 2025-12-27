'use client';

import { useMemo } from 'react';
import type { EnrollmentWizardData } from '../EnrollmentWizard';
import { useI18n } from '@/contexts/I18nContext';

interface EnrollmentStepOverviewProps {
  course: EnrollmentWizardData['course'];
  data: EnrollmentWizardData;
  updateData: (updates: Partial<EnrollmentWizardData>) => void;
}

export default function EnrollmentStepOverview({
  course,
}: EnrollmentStepOverviewProps) {
  const { t } = useI18n();

  const formatPrice = useMemo(() => {
    return (price: number) => new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(price);
  }, []);

  const formattedPrice = useMemo(() => formatPrice(course.price), [formatPrice, course.price]);
  const formattedOriginalPrice = useMemo(() => 
    course.original_price ? formatPrice(course.original_price) : null, 
    [formatPrice, course.original_price]
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
      <div className="bg-charcoal-50/50 dark:bg-navy-700/50 rounded-2xl p-6 md:p-8 space-y-6 border-2 border-emerald-200 dark:border-emerald-700/50">
        <div>
          <h4 className="text-xl md:text-2xl font-semibold text-charcoal-950 dark:text-white mb-3">
            {course.title}
          </h4>
          {course.description && (
            <p className="text-base text-charcoal-600 dark:text-gray-400 leading-relaxed">
              {course.description}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-charcoal-200/50 dark:border-navy-600/50">
          <div>
            <p className="text-sm md:text-base text-charcoal-500 dark:text-gray-400 mb-2">
              {t('payment.creator')}
            </p>
            <p className="text-lg font-medium text-charcoal-950 dark:text-white">
              {course.creator}
            </p>
          </div>
          <div>
            <p className="text-sm md:text-base text-charcoal-500 dark:text-gray-400 mb-2">
              {t('payment.price')}
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl md:text-3xl font-semibold text-charcoal-950 dark:text-white">
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
          <div className="pt-4 border-t border-charcoal-200/50 dark:border-navy-600/50">
            <span className="inline-block px-4 py-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-full text-sm font-semibold">
              {course.course_type}
            </span>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-5">
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



