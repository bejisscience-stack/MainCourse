'use client';

import { useState } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface ExpiredEnrollmentOverlayProps {
  courseId: string;
  courseName: string;
  expiresAt: string | null;
  onReEnrollRequest?: () => void;
}

export default function ExpiredEnrollmentOverlay({
  courseId,
  courseName,
  expiresAt,
  onReEnrollRequest,
}: ExpiredEnrollmentOverlayProps) {
  const { t } = useI18n();
  const [isRequesting, setIsRequesting] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);

  const handleReEnroll = async () => {
    setIsRequesting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error(t('enrollment.pleaseLogin'));
        return;
      }

      const response = await fetch('/api/enrollment-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          courseId,
          isReEnrollment: true,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || t('enrollment.reEnrollmentFailed'));
      }

      setHasRequested(true);
      toast.success(t('enrollment.reEnrollmentRequested'));
      onReEnrollRequest?.();
    } catch (err: unknown) {
      console.error('Re-enrollment error:', err);
      const errorMessage = err instanceof Error ? err.message : t('enrollment.reEnrollmentFailed');
      toast.error(errorMessage);
    } finally {
      setIsRequesting(false);
    }
  };

  const formattedDate = expiresAt
    ? new Date(expiresAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center">
      {/* Blur backdrop */}
      <div className="absolute inset-0 bg-navy-950/80 dark:bg-navy-950/90 backdrop-blur-md" />

      {/* Content */}
      <div className="relative z-10 text-center p-8 max-w-md">
        {/* Lock icon */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-800/50 dark:bg-gray-900/50 border border-gray-700 dark:border-gray-600 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-gray-400 dark:text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-white mb-3">
          {t('enrollment.enrollmentExpired')}
        </h2>

        {/* Description */}
        <p className="text-gray-400 dark:text-gray-300 mb-2">
          {t('enrollment.expiredDescription', { courseName })}
        </p>

        {formattedDate && (
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
            {t('enrollment.expiredOn', { date: formattedDate })}
          </p>
        )}

        {/* Re-Enroll button */}
        {!hasRequested ? (
          <button
            onClick={handleReEnroll}
            disabled={isRequesting}
            className="w-full inline-flex items-center justify-center px-6 py-3 text-base font-semibold text-white bg-emerald-500 rounded-xl hover:bg-emerald-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/25"
          >
            {isRequesting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t('enrollment.requesting')}
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {t('enrollment.reEnroll')}
              </>
            )}
          </button>
        ) : (
          <div className="px-6 py-3 bg-gray-800 dark:bg-gray-900 rounded-xl text-gray-300 dark:text-gray-200 flex items-center justify-center gap-2">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {t('enrollment.reEnrollmentPending')}
          </div>
        )}

        {/* Info text */}
        <p className="text-gray-500 dark:text-gray-400 text-xs mt-4">
          {t('enrollment.reEnrollmentInfo')}
        </p>
      </div>
    </div>
  );
}
