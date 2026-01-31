'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import CourseCard, { type Course } from '@/components/CourseCard';
import CourseEnrollmentCard from '@/components/CourseEnrollmentCard';
import { useCourses } from '@/hooks/useCourses';
import { useEnrollments } from '@/hooks/useEnrollments';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/contexts/I18nContext';
import { ScrollReveal } from './ScrollReveal';

export default function CoursesCarousel() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [enrollingCourseId, setEnrollingCourseId] = useState<string | null>(null);
  const { user, role: userRole } = useUser();
  const { courses, isLoading, error: coursesError } = useCourses('All');
  const { enrolledCourseIds, mutate: mutateEnrollments } = useEnrollments(user?.id || null);
  const { t, isReady: translationsReady } = useI18n();

  // Reset currentIndex when courses change
  useEffect(() => {
    if (courses.length > 0 && currentIndex >= courses.length) {
      setCurrentIndex(0);
    }
  }, [courses.length, currentIndex]);

  // Get 3 courses to display (previous, current, next)
  const displayedCourses = useMemo(() => {
    if (courses.length === 0) return [];

    // If we have less than 3 courses, just show what we have
    if (courses.length < 3) {
      return courses;
    }

    const prevIndex = currentIndex > 0 ? currentIndex - 1 : courses.length - 1;
    const nextIndex = currentIndex < courses.length - 1 ? currentIndex + 1 : 0;

    return [
      courses[prevIndex],
      courses[currentIndex],
      courses[nextIndex],
    ];
  }, [courses, currentIndex]);

  const handlePrevious = useCallback(() => {
    if (courses.length === 0) return;
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : courses.length - 1));
  }, [courses.length]);

  const handleNext = useCallback(() => {
    if (courses.length === 0) return;
    setCurrentIndex((prev) => (prev < courses.length - 1 ? prev + 1 : 0));
  }, [courses.length]);

  const handleEnroll = useCallback(async (courseId: string) => {
    if (!user) {
      router.push('/login?redirect=/');
      return;
    }

    if (userRole === 'lecturer') {
      return;
    }

    // Prevent duplicate enrollment attempts
    if (enrolledCourseIds.has(courseId)) {
      return;
    }

    setEnrollingCourseId(courseId);

    try {
      // Get access token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Create enrollment request via API
      const response = await fetch('/api/enrollment-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ courseId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create enrollment request');
      }

      // Success - refresh page to show updated state
      router.refresh();
    } catch (err: any) {
      console.error('Error requesting enrollment:', err);
      // Revalidate to get correct state
      await mutateEnrollments();
    } finally {
      setEnrollingCourseId(null);
    }
  }, [user, userRole, enrolledCourseIds, router, mutateEnrollments]);

  const handleCardClick = useCallback((index: number) => {
    if (courses.length >= 3) {
      if (index === 0) handlePrevious();
      if (index === 2) handleNext();
    } else {
      // For fewer courses, just set the index directly
      setCurrentIndex(index);
    }
  }, [courses.length, handlePrevious, handleNext]);

  if (isLoading || !translationsReady) {
    return (
      <section className="px-4 sm:px-6 lg:px-8 pb-24 md:pb-32">
        <div className="max-w-7xl mx-auto">
          <ScrollReveal delay={0} duration={600}>
            <h2 className="text-3xl md:text-4xl font-bold text-charcoal-950 dark:text-white text-center mb-12 tracking-tight">
              {translationsReady ? t('home.ourCourses') : 'Our Courses'}
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={100} duration={600}>
            <div className="flex items-center justify-center">
              <div className="text-charcoal-500 dark:text-gray-400">{translationsReady ? t('home.loadingCourses') : 'Loading courses...'}</div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    );
  }

  if (coursesError) {
    return (
      <section className="px-4 sm:px-6 lg:px-8 pb-24 md:pb-32">
        <div className="max-w-7xl mx-auto">
          <ScrollReveal delay={0} duration={600}>
            <h2 className="text-3xl md:text-4xl font-bold text-charcoal-950 dark:text-white text-center mb-12 tracking-tight">
              {translationsReady ? t('home.ourCourses') : 'Our Courses'}
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={100} duration={600}>
            <div className="flex flex-col items-center justify-center">
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-700 dark:text-red-400 px-6 py-4 rounded-2xl max-w-md text-center shadow-soft">
                <p className="font-medium mb-2">{translationsReady ? t('home.errorLoadingCourses') : 'Error Loading Courses'}</p>
                <p className="text-sm mb-4 text-red-600 dark:text-red-400">
                  {coursesError.message || (translationsReady ? t('home.errorMessage') : 'An error occurred')}
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="bg-charcoal-950 dark:bg-emerald-500 text-white px-5 py-2 rounded-full font-medium hover:bg-charcoal-800 dark:hover:bg-emerald-600 transition-all duration-200 hover:shadow-soft text-sm"
                >
                  {translationsReady ? t('common.retry') : 'Retry'}
                </button>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    );
  }

  if (courses.length === 0) {
    return null;
  }

  // Ensure currentIndex is within bounds
  const safeCurrentIndex = Math.min(currentIndex, Math.max(0, courses.length - 1));

  // Show arrows if we have 3+ courses (so we can navigate through them)
  const showArrows = courses.length >= 3;

  return (
    <section className="px-4 sm:px-6 lg:px-8 pb-24 md:pb-32">
      <div className="max-w-7xl mx-auto">
        <ScrollReveal delay={0} duration={600}>
          <div className="text-center mb-12">
            <Link
              href="/courses"
              className="inline-block text-3xl md:text-4xl font-bold text-charcoal-950 dark:text-white tracking-tight hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors duration-300 cursor-pointer"
            >
              {translationsReady ? t('home.ourCourses') : 'Our Courses'}
            </Link>
            <p className="mt-3 text-lg text-charcoal-600 dark:text-gray-400">
              {courses.length} {translationsReady ? t('home.coursesAvailable') : 'courses available'}
            </p>
          </div>
        </ScrollReveal>

        <div className="relative">
          {/* Mobile View: Vertical Stack of All Courses */}
          <div className="md:hidden flex flex-col gap-6 px-4">
            {courses.map((course) => {
              const isEnrolled = enrolledCourseIds.has(course.id);
              return (
                <div key={course.id} className="w-full">
                  <CourseEnrollmentCard
                    course={course}
                    isEnrolled={isEnrolled}
                    isEnrolling={false} // Mobile view doesn't need to track single enveloping loading state as strictly for UI position
                    onEnroll={undefined}
                    showEnrollButton={true}
                    userId={user?.id || null}
                  />
                </div>
              );
            })}
          </div>

          {/* Desktop View: Carousel (Original Implementation) */}
          <div className="hidden md:block relative">
            {/* Navigation Arrows - Show when we have 3+ courses */}
            {showArrows && (
              <>
                <button
                  onClick={handlePrevious}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-6 md:-translate-x-10 z-30 w-14 h-14 md:w-16 md:h-16 bg-white dark:bg-navy-800 rounded-full shadow-soft-xl dark:shadow-glow-dark flex items-center justify-center hover:bg-emerald-50 dark:hover:bg-emerald-500/20 transition-all duration-300 transform hover:scale-110 active:scale-95 border-2 border-charcoal-100/50 dark:border-emerald-500/30 hover:border-emerald-500 dark:hover:border-emerald-400 group will-change-transform"
                  style={{ transformOrigin: 'center', backfaceVisibility: 'hidden' }}
                  aria-label="Previous course"
                >
                  <svg
                    className="w-6 h-6 md:w-7 md:h-7 text-charcoal-950 dark:text-white group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors duration-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>

                <button
                  onClick={handleNext}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-6 md:translate-x-10 z-30 w-14 h-14 md:w-16 md:h-16 bg-white dark:bg-navy-800 rounded-full shadow-soft-xl dark:shadow-glow-dark flex items-center justify-center hover:bg-emerald-50 dark:hover:bg-emerald-500/20 transition-all duration-300 transform hover:scale-110 active:scale-95 border-2 border-charcoal-100/50 dark:border-emerald-500/30 hover:border-emerald-500 dark:hover:border-emerald-400 group will-change-transform"
                  style={{ transformOrigin: 'center', backfaceVisibility: 'hidden' }}
                  aria-label="Next course"
                >
                  <svg
                    className="w-6 h-6 md:w-7 md:h-7 text-charcoal-950 dark:text-white group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors duration-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </>
            )}

            {/* Courses Container */}
            <div className="flex items-center justify-center gap-6 md:gap-8 lg:gap-10 px-16 md:px-20 lg:px-24 overflow-hidden">
              {displayedCourses.map((course, index) => {
                // Middle course is always at index 1 if we have 3 courses
                // If we have fewer courses, highlight the one matching currentIndex
                const isMiddle = courses.length >= 3 ? index === 1 : index === currentIndex;
                const isEnrolled = enrolledCourseIds.has(course.id);
                const isEnrolling = enrollingCourseId === course.id;

                return (
                  <div
                    key={`${course.id}-${safeCurrentIndex}-${index}`}
                    onClick={() => handleCardClick(index)}
                    className={`transition-all duration-700 ease-out cursor-pointer ${isMiddle
                        ? 'flex-1 max-w-lg scale-100 z-10 opacity-100'
                        : 'flex-1 max-w-lg scale-95 opacity-70 z-0 hover:opacity-90'
                      }`}
                    style={{
                      transition: 'all 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    <CourseEnrollmentCard
                      course={course}
                      isEnrolled={isEnrolled}
                      isEnrolling={false}
                      onEnroll={undefined}
                      showEnrollButton={true}
                      userId={user?.id || null}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

