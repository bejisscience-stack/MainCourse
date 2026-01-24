'use client';

import { useMemo, useState, useCallback, memo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import CourseCard, { type Course } from './CourseCard';
import EnrollmentWizard from './EnrollmentWizard';
import { useEnrollmentRequestStatus } from '@/hooks/useEnrollmentRequests';
import { useRealtimeEnrollmentRequests } from '@/hooks/useRealtimeEnrollmentRequests';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/contexts/I18nContext';
import { useUser } from '@/hooks/useUser';
import { toast } from 'sonner';

interface CourseEnrollmentCardProps {
  course: Course;
  isEnrolled?: boolean;
  isEnrolling?: boolean;
  onEnroll?: (courseId: string) => void;
  showEnrollButton?: boolean;
  userId: string | null;
  initialReferralCode?: string | null;
  autoOpen?: boolean;
  onEnrollmentApproved?: () => void;
  isExpired?: boolean;
  expiresAt?: string | null;
  daysRemaining?: number | null;
}

/**
 * Wrapper around CourseCard that adds enrollment request status checking
 */
function CourseEnrollmentCard({
  course,
  isEnrolled = false,
  isEnrolling = false,
  onEnroll,
  showEnrollButton = true,
  userId,
  initialReferralCode,
  autoOpen = false,
  onEnrollmentApproved,
  isExpired = false,
  expiresAt = null,
  daysRemaining = null,
}: CourseEnrollmentCardProps) {
  const { t, isReady: translationsReady } = useI18n();
  const router = useRouter();
  const { user } = useUser();
  const [showEnrollmentWizard, setShowEnrollmentWizard] = useState(false);
  const isOpeningRef = useRef(false);
  const { request, hasPendingRequest, isLoading: isRequestLoading, mutate } = useEnrollmentRequestStatus(
    userId,
    course.id
  );

  // Handle button click to open enrollment wizard
  const handleOpenEnrollmentWizard = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Prevent multiple rapid clicks
    if (isOpeningRef.current || showEnrollmentWizard) {
      return;
    }
    
    // Check if user is authenticated before opening enrollment wizard
    if (!user) {
      const redirectUrl = `/courses?pendingEnroll=course:${course.id}`;
      router.push(`/login?redirect=${encodeURIComponent(redirectUrl)}`);
      return;
    }
    
    // Set flag to prevent multiple clicks
    isOpeningRef.current = true;
    
    // Immediately open the enrollment wizard
    setShowEnrollmentWizard(true);
    
    // Reset flag after a short delay
    setTimeout(() => {
      isOpeningRef.current = false;
    }, 300);
  }, [user, router, showEnrollmentWizard]);

  // Auto-open enrollment wizard if autoOpen is true and user is authenticated
  // This must be after hasPendingRequest is defined
  useEffect(() => {
    if (autoOpen && user && !isEnrolled && !hasPendingRequest && !showEnrollmentWizard) {
      // Use a small timeout to ensure state is ready
      const timer = setTimeout(() => {
        setShowEnrollmentWizard(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoOpen, user, isEnrolled, hasPendingRequest, showEnrollmentWizard]);

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
        // Show success toast
        toast.success(
          t('enrollment.enrollmentApproved') || `Your enrollment for "${course.title}" has been approved!`,
          { duration: 5000 }
        );
        // Call the callback to refresh enrollments list
        if (onEnrollmentApproved) {
          onEnrollmentApproved();
        }
      }
    },
    onRequestRejected: (rejectedRequest) => {
      // If this rejection is for the current course, show notification
      if (rejectedRequest.course_id === course.id) {
        mutate();
        toast.error(
          t('enrollment.enrollmentRejected') || `Your enrollment request for "${course.title}" was rejected.`,
          { duration: 5000 }
        );
      }
    },
  });

  // Determine the button state
  const buttonState = useMemo(() => {
    if (isEnrolled && isExpired) {
      // Check if there's a pending re-enrollment request
      if (hasPendingRequest) {
        return { type: 'pending' as const, disabled: true };
      }
      return { type: 'expired' as const, disabled: false };
    }
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
  }, [isEnrolled, isExpired, hasPendingRequest, isEnrolling, isRequestLoading]);

  // Custom action based on enrollment status
  const customAction = useMemo(() => {
    if (!showEnrollButton) return undefined;

    // Wait for translations to be ready before rendering buttons
    if (!translationsReady) {
      return (
        <button
          disabled
          className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-charcoal-950 dark:bg-emerald-500 rounded-full opacity-50 cursor-not-allowed"
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
          Loading...
        </button>
      );
    }

    if (buttonState.type === 'expired') {
      return (
        <div className="space-y-2">
          <button
            onClick={handleOpenEnrollmentWizard}
            className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-amber-500 rounded-full hover:bg-amber-600 transition-all duration-200 hover:shadow-soft hover:-translate-y-0.5 will-change-transform"
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
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {t('enrollment.reEnroll')}
          </button>
          <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
            {t('enrollment.expired')}
          </p>
        </div>
      );
    }

    if (buttonState.type === 'enrolled') {
      return (
        <div className="space-y-2">
          <a
            href={`/courses/${course.id}/chat`}
            className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-emerald-500 rounded-full hover:bg-emerald-600 transition-all duration-200 hover:shadow-soft hover:-translate-y-0.5 will-change-transform"
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
                d="M5 13l4 4L19 7"
              />
            </svg>
            {t('enrollment.goToCourse')}
          </a>
          {daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
              {t('enrollment.expiresIn', { days: daysRemaining })}
            </p>
          )}
        </div>
      );
    }

    if (buttonState.type === 'pending') {
      return (
        <button
          disabled
          className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-charcoal-500 dark:text-gray-400 bg-charcoal-100 dark:bg-navy-700 rounded-full cursor-not-allowed"
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
          className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-charcoal-950 dark:bg-emerald-500 rounded-full opacity-50 cursor-not-allowed"
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
        onClick={handleOpenEnrollmentWizard}
        disabled={buttonState.disabled}
        className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-charcoal-950 dark:bg-emerald-500 rounded-full hover:bg-charcoal-800 dark:hover:bg-emerald-600 transition-all duration-200 hover:shadow-soft dark:hover:shadow-glow-dark hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 will-change-transform"
        style={{ transformOrigin: 'center', backfaceVisibility: 'hidden' }}
        type="button"
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
  }, [buttonState, showEnrollButton, translationsReady, t, course.id, handleOpenEnrollmentWizard]);

  const handleEnrollmentWizardClose = useCallback(() => {
    setShowEnrollmentWizard(false);
    // Clear URL params when closing to prevent auto-reopening
    if (typeof window !== 'undefined' && window.history) {
      const url = new URL(window.location.href);
      url.searchParams.delete('course');
      url.searchParams.delete('ref');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  const handleEnrollmentSubmit = useCallback(async (courseId: string, screenshotUrls: string[], referralCode?: string) => {
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
          paymentScreenshots: screenshotUrls,
          referralCode: referralCode || undefined
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

      // Close wizard first
      setShowEnrollmentWizard(false);

      // Show success toast
      toast.success(
        t('enrollment.enrollmentRequestSubmitted') || 'Enrollment request submitted! Waiting for approval.',
        { duration: 5000 }
      );
    } catch (err: any) {
      console.error('Error requesting enrollment:', err);
      const errorMessage = err.message || 'Failed to create enrollment request. Please try again.';
      toast.error(errorMessage, { duration: 5000 });
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
      <EnrollmentWizard
        course={course}
        isOpen={showEnrollmentWizard}
        onClose={handleEnrollmentWizardClose}
        onEnroll={handleEnrollmentSubmit}
        initialReferralCode={initialReferralCode || undefined}
      />
    </>
  );
}

export default memo(CourseEnrollmentCard);

