'use client';

import { useMemo, useState, useCallback } from 'react';
import CourseCard, { type Course } from './CourseCard';
import PaymentDialog from './PaymentDialog';
import { useEnrollmentRequestStatus } from '@/hooks/useEnrollmentRequests';
import { useRealtimeEnrollmentRequests } from '@/hooks/useRealtimeEnrollmentRequests';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/contexts/I18nContext';

interface CourseEnrollmentCardProps {
  course: Course;
  isEnrolled?: boolean;
  isEnrolling?: boolean;
  onEnroll?: (courseId: string) => void;
  showEnrollButton?: boolean;
  userId: string | null;
}

/**
 * Wrapper around CourseCard that adds enrollment request status checking
 */
export default function CourseEnrollmentCard({
  course,
  isEnrolled = false,
  isEnrolling = false,
  onEnroll,
  showEnrollButton = true,
  userId,
}: CourseEnrollmentCardProps) {
  const { t } = useI18n();
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const { request, hasPendingRequest, isLoading: isRequestLoading, mutate } = useEnrollmentRequestStatus(
    userId,
    course.id
  );

  // Subscribe to real-time updates for this user's enrollment requests
  useRealtimeEnrollmentRequests({
    userId,
    onRequestUpdated: (updatedRequest) => {
      // If this update is for the current course, refresh the request status
      if (updatedRequest.course_id === course.id) {
        mutate();
      }
    },
    onRequestApproved: (approvedRequest) => {
      // If this approval is for the current course, refresh everything
      if (approvedRequest.course_id === course.id) {
        mutate();
        // Force a page refresh to update enrollment list
        setTimeout(() => {
          window.location.reload();
        }, 500);
      }
    },
  });

  // Determine the button state
  const buttonState = useMemo(() => {
    if (isEnrolled) {
      return { type: 'enrolled' as const, disabled: false };
    }
    if (hasPendingRequest) {
      return { type: 'pending' as const, disabled: true };
    }
    if (isEnrolling || isRequestLoading) {
      return { type: 'loading' as const, disabled: true };
    }
    return { type: 'request' as const, disabled: false };
  }, [isEnrolled, hasPendingRequest, isEnrolling, isRequestLoading]);

  // Custom action based on enrollment status
  const customAction = useMemo(() => {
    if (!showEnrollButton) return undefined;

    if (buttonState.type === 'enrolled') {
      return (
        <a
          href={`/courses/${course.id}/chat`}
          className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-green-500 rounded-full hover:bg-green-600 transition-colors"
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
              d="M5 13l4 4L19 7"
            />
          </svg>
          {t('enrollment.goToCourse')}
        </a>
      );
    }

    if (buttonState.type === 'pending') {
      return (
        <button
          disabled
          className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-200 rounded-full cursor-not-allowed"
        >
          <svg
            className="w-3.5 h-3.5 mr-1.5 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          {t('enrollment.pendingApproval')}
        </button>
      );
    }

    if (buttonState.type === 'loading') {
      return (
        <button
          disabled
          className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-navy-900 rounded-full opacity-50 cursor-not-allowed"
        >
          <svg
            className="animate-spin -ml-1 mr-2 h-3.5 w-3.5 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          {t('enrollment.requesting')}
        </button>
      );
    }

    // Default: Request Enrollment button
    return (
      <button
        onClick={() => setShowPaymentDialog(true)}
        disabled={buttonState.disabled}
        className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-navy-900 rounded-full hover:bg-navy-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            d="M12 4v16m8-8H4"
          />
        </svg>
        {t('enrollment.requestEnrollment')}
      </button>
    );
  }, [buttonState, showEnrollButton]);

  const handlePaymentDialogClose = useCallback(() => {
    setShowPaymentDialog(false);
  }, []);

  const handlePaymentSubmit = useCallback(async (courseId: string, screenshotUrls: string[]) => {
    if (!userId) {
      alert(t('enrollment.pleaseLogin'));
      return;
    }

    try {
      // Get access token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        console.error('Session error:', sessionError);
        throw new Error('Not authenticated. Please log in again.');
      }

      // Create enrollment request via API (after payment screenshot is uploaded)
      const response = await fetch('/api/enrollment-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          courseId,
          paymentScreenshots: screenshotUrls 
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

      // Success - refresh the request status
      await mutate();
      
      // Close dialog first
      setShowPaymentDialog(false);
      
      // Show success message
      alert(t('enrollment.enrollmentRequestSubmitted'));
      
      // Refresh page to show updated state
      window.location.reload();
    } catch (err: any) {
      console.error('Error requesting enrollment:', err);
      const errorMessage = err.message || 'Failed to create enrollment request. Please try again.';
      alert(errorMessage);
      // Don't close dialog on error so user can retry
    }
  }, [userId, mutate]);

  return (
    <>
      <CourseCard
        course={course}
        isEnrolled={isEnrolled}
        isEnrolling={isEnrolling}
        showEnrollButton={false}
        customAction={customAction}
      />
      <PaymentDialog
        course={course}
        isOpen={showPaymentDialog}
        onClose={handlePaymentDialogClose}
        onEnroll={handlePaymentSubmit}
      />
    </>
  );
}

