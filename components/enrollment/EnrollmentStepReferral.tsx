'use client';

import { useCallback } from 'react';
import type { EnrollmentWizardData } from '../EnrollmentWizard';
import { useI18n } from '@/contexts/I18nContext';

interface EnrollmentStepReferralProps {
  course: EnrollmentWizardData['course'];
  data: EnrollmentWizardData;
  updateData: (updates: Partial<EnrollmentWizardData>) => void;
}

export default function EnrollmentStepReferral({
  data,
  updateData,
}: EnrollmentStepReferralProps) {
  const { t } = useI18n();

  const handleReferralCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateData({ referralCode: e.target.value.toUpperCase().trim() });
  }, [updateData]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div>
        <h3 className="text-2xl font-bold text-charcoal-950 dark:text-white mb-2">
          {t('enrollment.stepReferralTitle')}
        </h3>
        <p className="text-charcoal-600 dark:text-gray-400">
          {t('enrollment.stepReferralDescription')}
        </p>
      </div>

      {/* Referral Code Input */}
      <div className="bg-gray-50 dark:bg-navy-700/50 rounded-lg p-5 md:p-6 border-2 border-emerald-200 dark:border-emerald-700/50">
        <label className="block text-base md:text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">
          {t('payment.referralCode')} <span className="text-gray-500 dark:text-gray-400 font-normal">({t('common.optional')})</span>
        </label>
        <input
          type="text"
          value={data.referralCode}
          onChange={handleReferralCodeChange}
          placeholder={t('payment.referralCodePlaceholder') || 'Enter referral code (optional)'}
          className="w-full px-5 py-3 text-base bg-white dark:bg-navy-800 border border-charcoal-200 dark:border-navy-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent text-charcoal-950 dark:text-white placeholder-charcoal-400 dark:placeholder-gray-500"
          maxLength={20}
        />
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          {t('payment.referralCodeDescription')}
        </p>
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
              {t('enrollment.referralInfoTitle')}
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
              {t('enrollment.referralInfoDescription')}
            </p>
          </div>
        </div>
      </div>

      {/* Skip Option */}
      {!data.referralCode && (
        <div className="text-center pt-4">
          <p className="text-sm text-charcoal-500 dark:text-gray-400">
            {t('enrollment.referralSkipMessage')}
          </p>
        </div>
      )}
    </div>
  );
}

