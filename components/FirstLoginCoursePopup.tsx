'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/contexts/I18nContext';
import { useUser } from '@/hooks/useUser';
import { useRouter } from 'next/navigation';
import type { Course } from './CourseCard';
import useSWR from 'swr';

interface FirstLoginCoursePopupProps {
  courseId: string;
  referralCode: string;
}

// Fetcher function for course
async function fetchCourse(courseId: string): Promise<Course | null> {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .single();

  if (error) {
    // Course not found or error fetching - return null
    return null;
  }

  return data as Course;
}

export default function FirstLoginCoursePopup({ courseId, referralCode }: FirstLoginCoursePopupProps) {
  const { t } = useI18n();
  const { user, profile, mutate } = useUser();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isMarkingComplete, setIsMarkingComplete] = useState(false);

  // Fetch course data
  const { data: course, isLoading: courseLoading, error: courseError } = useSWR<Course | null>(
    courseId ? ['course', courseId] : null,
    () => fetchCourse(courseId),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Cache for 1 minute
      onError: () => {
        // If course doesn't exist, mark first login as complete to prevent showing popup again
        // Note: markFirstLoginComplete will be called in useEffect when courseError is detected
      },
    }
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const markFirstLoginComplete = useCallback(async () => {
    if (!user || isMarkingComplete) return;

    setIsMarkingComplete(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ first_login_completed: true })
        .eq('id', user.id);

      if (!error) {
        // Refresh user data
        mutate();
      }
    } catch (err) {
      // Silently handle errors - user can dismiss popup manually
    } finally {
      setIsMarkingComplete(false);
    }
  }, [user, isMarkingComplete, mutate]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    // Mark first login as completed when popup is closed
    markFirstLoginComplete();
  }, [markFirstLoginComplete]);

  // Close modal on ESC key press
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, handleClose]);

  // Show popup if user hasn't completed first login yet
  useEffect(() => {
    if (mounted && user && profile && !courseLoading) {
      // If course doesn't exist or there's an error, mark first login as complete
      if (courseError || (course === null && !courseLoading)) {
        markFirstLoginComplete();
        return;
      }

      // Only show if:
      // 1. Course exists
      // 2. User was referred for this course
      // 3. First login not completed yet
      // 4. User has referral code
      if (
        course &&
        profile.referred_for_course_id === course.id &&
        !profile.first_login_completed &&
        referralCode
      ) {
        setIsOpen(true);
      }
    }
  }, [mounted, user, profile, course, courseLoading, courseError, referralCode, markFirstLoginComplete]);

  const handleEnroll = useCallback(async (courseId: string, screenshotUrls: string[], referralCode?: string) => {
    // This will be handled by the EnrollmentWizard's onEnroll prop
    // After enrollment, mark first login as complete
    await markFirstLoginComplete();
  }, [markFirstLoginComplete]);

  if (!isOpen || !mounted || typeof document === 'undefined' || !course || courseLoading) {
    return null;
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(price);
  };

  const dialogContent = (
    <div 
      className="fixed inset-0 bg-black/80 dark:bg-black/90 z-[9999] overflow-y-auto"
      onClick={handleClose}
    >
      <div 
        className="relative w-full min-h-full bg-white dark:bg-navy-800 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="fixed top-4 right-4 z-50 w-10 h-10 bg-gray-100 dark:bg-navy-700 hover:bg-gray-200 dark:hover:bg-navy-600 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 transition-colors shadow-lg"
          aria-label={t('common.close')}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <div className="w-full max-w-4xl mx-auto p-6 md:p-8 space-y-6 py-20">
          {/* Header */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full mb-4">
              <svg
                className="w-8 h-8 text-emerald-600 dark:text-emerald-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-charcoal-950 dark:text-white mb-3">
              {t('firstLogin.welcomeTitle') || 'Welcome! You\'ve Been Invited'}
            </h2>
            <p className="text-lg text-charcoal-600 dark:text-gray-400">
              {t('firstLogin.welcomeDescription') || 'You\'ve been invited to enroll in this course. Complete your purchase to get started!'}
            </p>
          </div>

          {/* Course Information Card */}
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-2xl p-6 md:p-8 border-2 border-emerald-200 dark:border-emerald-700/50">
            <div className="flex flex-col md:flex-row gap-6">
              {course.thumbnail_url && (
                <div className="flex-shrink-0">
                  <img
                    src={course.thumbnail_url}
                    alt={course.title}
                    className="w-full md:w-48 h-32 md:h-48 object-cover rounded-lg"
                  />
                </div>
              )}
              <div className="flex-1">
                <h3 className="text-2xl md:text-3xl font-bold text-charcoal-950 dark:text-white mb-2">
                  {course.title}
                </h3>
                {course.description && (
                  <p className="text-charcoal-600 dark:text-gray-400 mb-4 line-clamp-3">
                    {course.description}
                  </p>
                )}
                <div className="flex items-center justify-between pt-4 border-t border-emerald-200 dark:border-emerald-700/50">
                  <div>
                    <p className="text-sm text-charcoal-500 dark:text-gray-400 mb-1">
                      {t('payment.creator')}
                    </p>
                    <p className="text-lg font-medium text-charcoal-950 dark:text-white">
                      {course.creator}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-charcoal-500 dark:text-gray-400 mb-1">
                      {t('payment.price')}
                    </p>
                    <p className="text-2xl md:text-3xl font-semibold text-charcoal-950 dark:text-white">
                      {formatPrice(course.price)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Referral Code Info */}
          {referralCode && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
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
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1">
                    {t('firstLogin.referralCodeApplied') || 'Referral Code Applied'}
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    {t('firstLogin.referralCodeInfo')?.replace('{{code}}', referralCode) || 
                      `Your referral code "${referralCode}" will be automatically applied when you proceed to checkout.`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4 pt-6">
            <button
              onClick={handleClose}
              className="px-8 py-3 text-base font-semibold text-charcoal-600 dark:text-gray-300 bg-charcoal-100 dark:bg-navy-700 rounded-full hover:bg-charcoal-200 dark:hover:bg-navy-600 transition-colors"
            >
              {t('firstLogin.buyLater') || 'I\'ll Buy Later'}
            </button>
            <button
              onClick={() => {
                handleClose();
                // Navigate to courses page - the referral code will auto-fill when they enroll
                router.push(`/courses?course=${course.id}`);
              }}
              className="px-8 py-3 text-base font-semibold text-white bg-emerald-500 dark:bg-emerald-600 rounded-full hover:bg-emerald-600 dark:hover:bg-emerald-700 transition-all duration-200 hover:shadow-lg"
            >
              {t('firstLogin.proceedToPurchase') || 'Proceed to Purchase'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(dialogContent, document.body);
}

