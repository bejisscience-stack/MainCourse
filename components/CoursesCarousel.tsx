'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
  const [showAllMobile, setShowAllMobile] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [enrollingCourseId, setEnrollingCourseId] = useState<string | null>(null);
  const { user, role: userRole } = useUser();
  const { courses, isLoading, error: coursesError } = useCourses('All');
  const { enrolledCourseIds, getEnrollmentInfo, mutate: mutateEnrollments } = useEnrollments(user?.id || null);
  const { t, isReady: translationsReady } = useI18n();

  // Reset currentIndex when courses change
  useEffect(() => {
    if (courses.length > 0 && currentIndex >= courses.length) {
      setCurrentIndex(0);
    }
  }, [courses.length, currentIndex]);

  // Auto-rotation every 4 seconds when not hovered
  useEffect(() => {
    if (courses.length < 2) return;
    const interval = setInterval(() => {
      if (!isHovered) {
        setCurrentIndex(prev => (prev + 1) % courses.length);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [isHovered, courses.length]);

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

    if (enrolledCourseIds.has(courseId)) {
      return;
    }

    setEnrollingCourseId(courseId);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

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

      router.refresh();
    } catch (err: any) {
      console.error('Error requesting enrollment:', err);
      await mutateEnrollments();
    } finally {
      setEnrollingCourseId(null);
    }
  }, [user, userRole, enrolledCourseIds, router, mutateEnrollments]);

  // Show loading state only briefly - never block content for long
  if (isLoading && courses.length === 0) {
    return (
      <section className="px-4 sm:px-6 lg:px-8 pb-24 md:pb-32">
        <div className="max-w-7xl mx-auto">
          <ScrollReveal delay={0} duration={600}>
            <h2 className="text-3xl md:text-4xl font-bold text-charcoal-950 dark:text-white text-center mb-12 tracking-tight">
              {t('home.ourCourses')}
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={100} duration={600}>
            <div className="flex items-center justify-center py-12">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
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

  const safeCurrentIndex = Math.min(currentIndex, Math.max(0, courses.length - 1));
  const showArrows = courses.length >= 2;

  // 3D ring calculations
  const anglePerItem = 360 / courses.length;
  const ringRotation = -safeCurrentIndex * anglePerItem;
  const radius = Math.max(420, Math.round((300 * courses.length) / (2 * Math.PI)) + 60);

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
          {/* Mobile View: Vertical Stack of All Courses — unchanged */}
          <div className="md:hidden flex flex-col gap-6 px-4">
            {courses.slice(0, showAllMobile ? undefined : 3).map((course) => {
              const isEnrolled = enrolledCourseIds.has(course.id);
              const enrollmentInfo = getEnrollmentInfo(course.id);
              return (
                <div key={course.id} className="w-full">
                  <CourseEnrollmentCard
                    course={course}
                    isEnrolled={isEnrolled}
                    isEnrolling={false}
                    onEnroll={undefined}
                    showEnrollButton={true}
                    userId={user?.id || null}
                    isExpired={enrollmentInfo?.isExpired}
                    expiresAt={enrollmentInfo?.expiresAt}
                    daysRemaining={enrollmentInfo?.daysRemaining}
                  />
                </div>
              );
            })}

            {courses.length > 3 && (
              <div className="flex justify-center mt-2">
                <button
                  onClick={() => setShowAllMobile(!showAllMobile)}
                  className="px-6 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 bg-white dark:bg-navy-800 text-charcoal-600 dark:text-gray-300 border border-charcoal-200 dark:border-navy-700 hover:bg-gray-50 dark:hover:bg-navy-700 hover:text-charcoal-900 dark:hover:text-white shadow-sm flex items-center gap-2"
                >
                  {showAllMobile ? (
                    <>
                      <span>{translationsReady ? t('common.showLess') : 'Show Less'}</span>
                      <svg className="w-4 h-4 transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </>
                  ) : (
                    <>
                      <span>{translationsReady ? t('common.showMore') : 'Show More'}</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Desktop View: 3D Circular Gallery */}
          <div className="hidden md:block relative">
            {/* Navigation Arrows */}
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}

            {/* 3D Ring — perspective container */}
            <div
              style={{ perspective: '2000px', height: '520px', position: 'relative' }}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              {/* Rotating ring */}
              <div
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  transformStyle: 'preserve-3d',
                  transform: `rotateY(${ringRotation}deg)`,
                  transition: 'transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                {courses.map((course, i) => {
                  const isEnrolled = enrolledCourseIds.has(course.id);
                  const isEnrolling = enrollingCourseId === course.id;
                  const enrollmentInfo = getEnrollmentInfo(course.id);

                  // Angular distance from the front face (0° = front)
                  const cardAngle = ((i * anglePerItem) + ringRotation + 360) % 360;
                  const normalizedAngle = cardAngle > 180 ? 360 - cardAngle : cardAngle;
                  // Front half (<90°) fully visible; 90–120° fade out; back half (>120°) hidden
                  const opacity =
                    normalizedAngle < 90 ? 1 :
                    normalizedAngle > 120 ? 0 :
                    (120 - normalizedAngle) / 30;

                  return (
                    <div
                      key={course.id}
                      style={{
                        position: 'absolute',
                        width: '300px',
                        left: '50%',
                        top: '50%',
                        marginLeft: '-150px',
                        marginTop: '-210px',
                        transform: `rotateY(${i * anglePerItem}deg) translateZ(${radius}px)`,
                        opacity,
                        pointerEvents: opacity > 0.1 ? 'auto' : 'none',
                        transition: 'opacity 0.3s ease',
                        cursor: i !== safeCurrentIndex ? 'pointer' : 'default',
                      }}
                      onClick={() => {
                        if (i !== safeCurrentIndex && opacity > 0.1) {
                          setCurrentIndex(i);
                        }
                      }}
                    >
                      <CourseEnrollmentCard
                        course={course}
                        isEnrolled={isEnrolled}
                        isEnrolling={isEnrolling}
                        onEnroll={undefined}
                        showEnrollButton={true}
                        userId={user?.id || null}
                        isExpired={enrollmentInfo?.isExpired}
                        expiresAt={enrollmentInfo?.expiresAt}
                        daysRemaining={enrollmentInfo?.daysRemaining}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
