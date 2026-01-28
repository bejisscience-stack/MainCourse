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
      <div className="bg-white/50 dark:bg-navy-800/50 rounded-2xl p-6 md:p-8 border border-charcoal-100/50 dark:border-navy-700/50 shadow-soft">
        <p className="text-sm font-medium uppercase tracking-wide text-charcoal-500 dark:text-gray-400 mb-3">
          {t('payment.accountNumber')}
        </p>
        <div className="flex items-center gap-3">
          <p className="text-2xl md:text-3xl font-mono font-bold text-charcoal-950 dark:text-white break-all tracking-tight">
            GE00BG0000000013231
          </p>
          <button 
            onClick={() => navigator.clipboard.writeText('GE00BG0000000013231')}
            className="p-2 hover:bg-charcoal-100 dark:hover:bg-navy-700 rounded-lg transition-colors text-charcoal-400 hover:text-charcoal-600 dark:text-gray-500 dark:hover:text-gray-300"
            title="Copy"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Unique Course Code */}
      <div className="bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl p-6 md:p-8 border border-emerald-100 dark:border-emerald-800/50">
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-3">
          {t('payment.uniqueCourseCode')}
        </p>
        <div className="flex items-center gap-3">
          <p className="text-4xl md:text-5xl font-mono font-bold text-charcoal-950 dark:text-white tracking-widest">
            {courseCode}
          </p>
          <button 
            onClick={() => navigator.clipboard.writeText(courseCode)}
            className="p-2 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded-lg transition-colors text-emerald-600/60 hover:text-emerald-600 dark:text-emerald-500/60 dark:hover:text-emerald-400"
            title="Copy"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
        <p className="text-sm text-emerald-700/80 dark:text-emerald-400/80 mt-4 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {t('payment.includeCodeInReference')}
        </p>
      </div>

      {/* Payment Instructions Images */}
      <div className="space-y-6">
        <div>
          <h4 className="text-xl font-bold text-charcoal-950 dark:text-white mb-6">
            {t('payment.paymentInstructionsTitle')}
          </h4>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* First Instruction Image */}
            <div className="bg-white dark:bg-navy-800 border border-charcoal-100 dark:border-navy-700 rounded-2xl p-5 shadow-soft hover:shadow-lg transition-shadow duration-300">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-8 h-8 rounded-full bg-charcoal-950 dark:bg-white text-white dark:text-charcoal-950 flex items-center justify-center font-bold text-sm">1</span>
                <p className="text-base font-semibold text-charcoal-950 dark:text-white">
                  {t('payment.step1')}
                </p>
              </div>
              <div className="relative w-full bg-charcoal-50 dark:bg-navy-900 rounded-xl overflow-hidden border border-charcoal-100 dark:border-navy-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/payment-instructions/payment-step-1.png"
                  alt="Payment instruction step 1 - Enter account number GE00BG0000000013231"
                  className="w-full h-auto object-contain block hover:scale-105 transition-transform duration-500"
                  style={{ maxHeight: '600px' }}
                  loading="lazy"
                />
              </div>
            </div>

            {/* Second Instruction Image */}
            <div className="bg-white dark:bg-navy-800 border border-charcoal-100 dark:border-navy-700 rounded-2xl p-5 shadow-soft hover:shadow-lg transition-shadow duration-300">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-8 h-8 rounded-full bg-charcoal-950 dark:bg-white text-white dark:text-charcoal-950 flex items-center justify-center font-bold text-sm">2</span>
                <p className="text-base font-semibold text-charcoal-950 dark:text-white">
                  {t('payment.step2')}
                </p>
              </div>
              <div className="relative w-full bg-charcoal-50 dark:bg-navy-900 rounded-xl overflow-hidden border border-charcoal-100 dark:border-navy-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/payment-instructions/payment-step-2.png"
                  alt="Payment instruction step 2 - Complete payment with unique code in description field"
                  className="w-full h-auto object-contain block hover:scale-105 transition-transform duration-500"
                  style={{ maxHeight: '600px' }}
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Important Notice */}
      <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/50 rounded-2xl p-5">
        <div className="flex items-start space-x-3">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg shrink-0">
            <svg
              className="w-5 h-5 text-amber-600 dark:text-amber-400"
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
          </div>
          <div>
            <p className="text-base font-bold text-charcoal-950 dark:text-white">
              {t('enrollment.paymentImportantNotice')}
            </p>
            <p className="text-sm text-charcoal-600 dark:text-gray-400 mt-1 leading-relaxed">
              {t('enrollment.paymentImportantDescription')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}



