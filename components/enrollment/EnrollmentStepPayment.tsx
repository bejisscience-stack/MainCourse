'use client';

import { useMemo } from 'react';
import type { EnrollmentWizardData } from '../EnrollmentWizard';
import { useI18n } from '@/contexts/I18nContext';

interface EnrollmentStepPaymentProps {
  course: EnrollmentWizardData['course'];
  data: EnrollmentWizardData;
  updateData: (updates: Partial<EnrollmentWizardData>) => void;
}

// Generate a unique 5-digit code from course ID (uppercase letters and numbers)
function generateCourseCode(courseId: string): string {
  let hash = 0;
  for (let i = 0; i < courseId.length; i++) {
    const char = courseId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  let num = Math.abs(hash);
  
  for (let i = 0; i < 5; i++) {
    code += chars[num % chars.length];
    num = Math.floor(num / chars.length);
  }
  
  return code;
}

export default function EnrollmentStepPayment({
  course,
}: EnrollmentStepPaymentProps) {
  const { t } = useI18n();

  const courseCode = useMemo(() => generateCourseCode(course.id), [course.id]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div>
        <h3 className="text-2xl font-bold text-charcoal-950 dark:text-white mb-2">
          {t('enrollment.stepPaymentTitle')}
        </h3>
        <p className="text-charcoal-600 dark:text-gray-400">
          {t('enrollment.stepPaymentDescription')}
        </p>
      </div>

      {/* Account Number */}
      <div className="bg-gray-50 dark:bg-navy-700/50 rounded-lg p-5 md:p-6 border-2 border-emerald-200 dark:border-emerald-700/50">
        <p className="text-base md:text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
          {t('payment.accountNumber')}
        </p>
        <p className="text-xl md:text-2xl font-mono font-semibold text-gray-900 dark:text-white break-all">
          GE00BG0000000013231
        </p>
      </div>

      {/* Unique Course Code */}
      <div className="bg-charcoal-50/50 dark:bg-navy-700/50 rounded-2xl p-6 md:p-7 border-2 border-emerald-200 dark:border-emerald-700/50">
        <p className="text-base md:text-lg font-medium text-charcoal-600 dark:text-gray-400 mb-3">
          {t('payment.uniqueCourseCode')}
        </p>
        <p className="text-3xl md:text-4xl font-mono font-semibold text-charcoal-950 dark:text-white tracking-wider">
          {courseCode}
        </p>
        <p className="text-sm text-charcoal-500 dark:text-gray-500 mt-3">
          {t('payment.includeCodeInReference')}
        </p>
      </div>

      {/* Payment Instructions Images */}
      <div className="space-y-4 md:space-y-6">
        <div>
          <p className="text-xl md:text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-4 md:mb-6">
            {t('payment.paymentInstructionsTitle')}
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {/* First Instruction Image */}
            <div className="bg-white dark:bg-navy-700/50 border border-gray-200 dark:border-navy-600 rounded-lg p-4 md:p-5 shadow-sm">
              <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
                {t('payment.step1')}
              </p>
              <div className="relative w-full bg-gray-50 dark:bg-navy-800 rounded-lg overflow-hidden border border-gray-200 dark:border-navy-600">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/payment-instructions/payment-step-1.png"
                  alt="Payment instruction step 1 - Enter account number GE00BG0000000013231"
                  className="w-full h-auto object-contain block"
                  style={{ maxHeight: '600px' }}
                  loading="lazy"
                />
              </div>
            </div>

            {/* Second Instruction Image */}
            <div className="bg-white dark:bg-navy-700/50 border border-gray-200 dark:border-navy-600 rounded-lg p-4 md:p-5 shadow-sm">
              <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
                {t('payment.step2')}
              </p>
              <div className="relative w-full bg-gray-50 dark:bg-navy-800 rounded-lg overflow-hidden border border-gray-200 dark:border-navy-600">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/payment-instructions/payment-step-2.png"
                  alt="Payment instruction step 2 - Complete payment with unique code in description field"
                  className="w-full h-auto object-contain block"
                  style={{ maxHeight: '600px' }}
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Important Notice */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-5">
        <div className="flex items-start space-x-3">
          <svg
            className="w-6 h-6 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <p className="text-base font-semibold text-yellow-800 dark:text-yellow-300">
              {t('enrollment.paymentImportantNotice')}
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
              {t('enrollment.paymentImportantDescription')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}



