'use client';

import { useState, useCallback } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import EnrollmentWizard from './EnrollmentWizard';
import type { Course } from './CourseCard';
import { clearReferral } from '@/lib/referral-storage';

interface ExpiredEnrollmentOverlayProps {
  course: Course;
  expiresAt: string | null;
  onReEnrollRequest?: () => void;
}

export default function ExpiredEnrollmentOverlay({
  course,
  expiresAt,
  onReEnrollRequest,
}: ExpiredEnrollmentOverlayProps) {
  const { t } = useI18n();
  const [showEnrollmentWizard, setShowEnrollmentWizard] = useState(false);

  const handleOpenEnrollmentWizard = useCallback(() => {
    setShowEnrollmentWizard(true);
  }, []);

  const handleCloseEnrollmentWizard = useCallback(() => {
    setShowEnrollmentWizard(false);
  }, []);

  const handleEnrollmentSubmit = useCallback(async (courseId: string, screenshotUrls: string[], referralCode?: string) => {
    try {
      // Get access token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        console.error('Session error:', sessionError);
        throw new Error('Not authenticated. Please log in again.');
      }

      // Create re-enrollment request via API (with payment screenshot)
      const response = await fetch('/api/enrollment-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          courseId,
          paymentScreenshots: screenshotUrls,
          referralCode: referralCode || undefined,
          isReEnrollment: true
        }),
      });

      let result;
      try {
        result = await response.json();
      } catch (jsonError) {
        console.error('Failed to parse response:', jsonError);
        throw new Error('Server returned an invalid response. Please try again.');
      }

      if (!response.ok) {
        const errorMessage = result?.error || result?.details || `Server error (${response.status})`;
        console.error('API error:', {
          status: response.status,
          statusText: response.statusText,
          error: result,
        });
        throw new Error(errorMessage);
      }

      // Success - close wizard
      setShowEnrollmentWizard(false);

      // Show success toast
      toast.success(
        t('enrollment.reEnrollmentRequested') || 'Re-enrollment request submitted! Waiting for approval.',
        { duration: 5000 }
      );

      // Clear referral from persistent storage after successful enrollment
      clearReferral();

      // Notify parent to refresh enrollments
      onReEnrollRequest?.();
    } catch (err: any) {
      console.error('Error requesting re-enrollment:', err);
      const errorMessage = err.message || 'Failed to create re-enrollment request. Please try again.';
      toast.error(errorMessage, { duration: 5000 });
      // Don't close dialog on error so user can retry
      throw err;
    }
  }, [t, onReEnrollRequest]);

  const formattedDate = expiresAt
    ? new Date(expiresAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <>
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
            {t('enrollment.expiredDescription', { courseName: course.title })}
          </p>

          {formattedDate && (
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
              {t('enrollment.expiredOn', { date: formattedDate })}
            </p>
          )}

          {/* Re-Enroll button */}
          <button
            onClick={handleOpenEnrollmentWizard}
            className="w-full inline-flex items-center justify-center px-6 py-3 text-base font-semibold text-white bg-emerald-500 rounded-xl hover:bg-emerald-600 transition-all duration-200 shadow-lg shadow-emerald-500/25"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {t('enrollment.reEnroll')}
          </button>

          {/* Info text */}
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-4">
            {t('enrollment.reEnrollmentInfo')}
          </p>
        </div>
      </div>

      {/* Enrollment Wizard */}
      <EnrollmentWizard
        course={course}
        isOpen={showEnrollmentWizard}
        onClose={handleCloseEnrollmentWizard}
        onEnroll={handleEnrollmentSubmit}
      />
    </>
  );
}
