'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import BackgroundShapes from '@/components/BackgroundShapes';
import PaymentDialog from '@/components/PaymentDialog';
import CourseEnrollmentCard from '@/components/CourseEnrollmentCard';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';
import { useEnrollments } from '@/hooks/useEnrollments';
import useSWR from 'swr';
import type { Course } from '@/hooks/useCourses';
import type { Course as CourseCardCourse } from '@/components/CourseCard';
import { useI18n } from '@/contexts/I18nContext';

export default function MyCoursesPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { user, role: userRole, isLoading: userLoading } = useUser();
  const { enrolledCourseIds, mutate: mutateEnrollments } = useEnrollments(user?.id || null);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentDialogCourse, setPaymentDialogCourse] = useState<CourseCardCourse | null>(null);

  // Redirect lecturers immediately
  useEffect(() => {
    if (!userLoading && userRole === 'lecturer') {
      router.push('/lecturer/dashboard');
    }
  }, [userRole, userLoading, router]);

  // Redirect if not logged in
  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login');
    }
  }, [user, userLoading, router]);

  // Fetch enrolled courses - use stable key with user ID and enrolled IDs
  const enrolledIdsArray = useMemo(() => Array.from(enrolledCourseIds).sort(), [enrolledCourseIds]);
  
  const { data: enrolledCourses = [], isLoading: enrolledLoading, mutate: mutateEnrolledCourses } = useSWR<Course[]>(
    user ? ['enrolled-courses', user.id, enrolledIdsArray.join(',')] : null,
    async () => {
      if (enrolledIdsArray.length === 0) return [];
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .in('id', enrolledIdsArray)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  );

  // Fetch discover courses (not enrolled) - optimized to filter in database
  const { data: discoverCourses = [], isLoading: discoverLoading, mutate: mutateDiscoverCourses } = useSWR<Course[]>(
    user ? ['discover-courses', user.id, enrolledIdsArray.join(',')] : null,
    async () => {
      // Optimized: Filter in database instead of JavaScript when possible
      if (enrolledIdsArray.length > 0) {
        // Use database filter to exclude enrolled courses
        const { data: allCourses, error } = await supabase
          .from('courses')
          .select('*')
          .not('id', 'in', `(${enrolledIdsArray.map(id => `"${id}"`).join(',')})`)
          .order('created_at', { ascending: false });

        if (error) {
          // Fallback to JavaScript filtering if database filter fails
          const { data: allCoursesFallback, error: fallbackError } = await supabase
            .from('courses')
            .select('*')
            .order('created_at', { ascending: false });
          
          if (fallbackError) throw fallbackError;
          const enrolledSet = new Set(enrolledIdsArray);
          return (allCoursesFallback || []).filter(course => !enrolledSet.has(course.id));
        }
        
        return allCourses || [];
      }
      
      // No enrolled courses, fetch all
      const { data: allCourses, error } = await supabase
        .from('courses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return allCourses || [];
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  );

  // Note: Enrollment requests are now handled through PaymentDialog in CourseEnrollmentCard
  // This handler is no longer needed but kept for compatibility

  const CourseCard = ({
    course,
    action,
  }: {
    course: Course;
    action?: React.ReactNode;
  }) => (
    <div className="bg-white dark:bg-navy-800 border border-charcoal-100/50 dark:border-navy-700/50 rounded-3xl overflow-hidden shadow-soft hover:shadow-soft-lg dark:hover:shadow-glow-dark transition-all duration-200 hover:scale-[1.01] hover:-translate-y-0.5">
      <div className="p-6">
        <div className="mb-4">
          <p className="text-xs font-semibold text-emerald-500 dark:text-emerald-400 uppercase tracking-wide mb-2">
            {course.course_type}
          </p>
          <h3 className="text-lg font-bold text-charcoal-950 dark:text-white line-clamp-2 mb-2">{course.title}</h3>
          {course.description && (
            <p className="text-sm text-charcoal-600 dark:text-gray-400 mt-2 line-clamp-3">{course.description}</p>
          )}
        </div>
        <div className="flex items-center justify-between text-sm text-charcoal-700 dark:text-gray-300 mb-4">
          <div>
            <span className="font-semibold text-charcoal-950 dark:text-white">${course.price}</span>
            {course.original_price && (
              <span className="line-through text-charcoal-400 dark:text-gray-500 ml-2">${course.original_price}</span>
            )}
          </div>
          <div className="text-xs text-charcoal-500 dark:text-gray-400">
            {course.rating?.toFixed(1) ?? '0.0'} ★ ({course.review_count ?? 0})
          </div>
        </div>
        {action}
      </div>
    </div>
  );

  const isLoading = userLoading || enrolledLoading || discoverLoading;

  if (isLoading) {
    return (
      <main className="relative min-h-screen bg-gradient-to-b from-[#fafafa] to-white dark:from-navy-950 dark:to-navy-900 overflow-hidden">
        <BackgroundShapes />
        <Navigation />
        <div className="relative z-10 pt-24 pb-16 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            <p className="mt-4 text-charcoal-600 dark:text-gray-400">{t('myCourses.loadingCourses')}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-[#fafafa] to-white dark:from-navy-950 dark:to-navy-900 overflow-hidden">
      <BackgroundShapes />
      <Navigation />
      <div className="relative z-10 pt-24 pb-16 md:pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-charcoal-950 dark:text-white mb-3">{t('myCourses.title')}</h1>
            <p className="text-lg text-charcoal-600 dark:text-gray-400">{t('myCourses.subtitle')}</p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm animate-in fade-in">
              <div className="flex items-start">
                <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <p className="font-semibold">{t('myCourses.errorLoadingCourses')}</p>
                  <p className="mt-1 text-sm">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Enrolled courses */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl md:text-3xl font-bold text-charcoal-950 dark:text-white">{t('myCourses.enrolled')}</h2>
              <span className="text-sm text-charcoal-600 dark:text-gray-400">{t('myCourses.courseCount', { count: enrolledCourses.length })}</span>
            </div>
            {enrolledCourses.length === 0 ? (
              <div className="bg-white dark:bg-navy-800 border border-charcoal-100/50 dark:border-navy-700/50 rounded-3xl p-8 text-center text-charcoal-700 dark:text-gray-300 shadow-soft">
                {t('myCourses.noEnrolledCourses')}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {enrolledCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    action={
                      <a
                        href={`/courses/${course.id}/chat`}
                        className="inline-flex items-center justify-center w-full px-4 py-3 text-sm font-semibold text-white bg-emerald-500 dark:bg-emerald-500 rounded-xl hover:bg-emerald-600 dark:hover:bg-emerald-600 transition-all duration-200 hover:shadow-glow-dark"
                      >
                        {t('myCourses.viewCourse')}
                      </a>
                    }
                  />
                ))}
              </div>
            )}
          </section>

          {/* Discover */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl md:text-3xl font-bold text-charcoal-950 dark:text-white">{t('myCourses.discoverNew')}</h2>
              <span className="text-sm text-charcoal-600 dark:text-gray-400">{discoverCourses.length} {t('myCourses.available')}</span>
            </div>
            {discoverCourses.length === 0 ? (
              <div className="bg-white dark:bg-navy-800 border border-charcoal-100/50 dark:border-navy-700/50 rounded-3xl p-8 text-center text-charcoal-700 dark:text-gray-300 shadow-soft">
                {t('myCourses.enrolledInAll')}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {discoverCourses.map((course) => {
                  // Convert Course to CourseCardCourse format
                  const courseCardCourse: CourseCardCourse = {
                    id: course.id,
                    title: course.title,
                    description: course.description,
                    course_type: course.course_type as 'Editing' | 'Content Creation' | 'Website Creation',
                    price: course.price,
                    original_price: course.original_price,
                    author: course.author || '',
                    creator: course.creator || '',
                    intro_video_url: course.intro_video_url,
                    thumbnail_url: course.thumbnail_url,
                    rating: course.rating || 0,
                    review_count: course.review_count || 0,
                    is_bestseller: course.is_bestseller || false,
                  };

                  return (
                    <CourseEnrollmentCard
                      key={course.id}
                      course={courseCardCourse}
                      isEnrolled={false}
                      isEnrolling={false}
                      onEnroll={undefined}
                      showEnrollButton={true}
                      userId={user?.id || null}
                    />
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Payment Dialog */}
      {paymentDialogCourse && (
        <PaymentDialog
          course={paymentDialogCourse}
          isOpen={!!paymentDialogCourse}
          onClose={() => setPaymentDialogCourse(null)}
          onEnroll={async () => {
            // Enrollment is handled by CourseEnrollmentCard
            setPaymentDialogCourse(null);
            await mutateEnrollments();
          }}
        />
      )}
    </main>
  );
}
