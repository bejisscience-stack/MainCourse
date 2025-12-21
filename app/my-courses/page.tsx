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

  // Fetch discover courses (not enrolled) - use stable key with user ID
  const { data: discoverCourses = [], isLoading: discoverLoading, mutate: mutateDiscoverCourses } = useSWR<Course[]>(
    user ? ['discover-courses', user.id, enrolledIdsArray.join(',')] : null,
    async () => {
      // Fetch all courses first
      const { data: allCourses, error } = await supabase
        .from('courses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Filter out enrolled courses in JavaScript (more reliable than Supabase .not() syntax)
      if (enrolledIdsArray.length > 0) {
        const enrolledSet = new Set(enrolledIdsArray);
        return (allCourses || []).filter(course => !enrolledSet.has(course.id));
      }
      
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
    <div className="bg-white border border-navy-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="mb-3">
        <p className="text-xs font-semibold text-navy-500 uppercase tracking-wide mb-1">
          {course.course_type}
        </p>
        <h3 className="text-lg font-bold text-navy-900 line-clamp-2">{course.title}</h3>
        {course.description && (
          <p className="text-sm text-navy-600 mt-2 line-clamp-3">{course.description}</p>
        )}
      </div>
      <div className="flex items-center justify-between text-sm text-navy-700 mb-3">
        <div>
          <span className="font-semibold">${course.price}</span>
          {course.original_price && (
            <span className="line-through text-navy-400 ml-2">${course.original_price}</span>
          )}
        </div>
        <div className="text-xs text-navy-500">
          {course.rating?.toFixed(1) ?? '0.0'} ★ ({course.review_count ?? 0})
        </div>
      </div>
      {action}
    </div>
  );

  const isLoading = userLoading || enrolledLoading || discoverLoading;

  if (isLoading) {
    return (
      <main className="relative min-h-screen bg-white overflow-hidden">
        <BackgroundShapes />
        <Navigation />
        <div className="relative z-10 pt-24 pb-16 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-navy-900"></div>
            <p className="mt-4 text-navy-600">{t('myCourses.loadingCourses')}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-white overflow-hidden">
      <BackgroundShapes />
      <Navigation />
      <div className="relative z-10 pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-navy-900 mb-2">{t('myCourses.title')}</h1>
            <p className="text-navy-600">{t('myCourses.subtitle')}</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm animate-in fade-in">
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
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-navy-900">{t('myCourses.enrolled')}</h2>
              <span className="text-sm text-navy-600">{t('myCourses.courseCount', { count: enrolledCourses.length })}</span>
            </div>
            {enrolledCourses.length === 0 ? (
              <div className="bg-navy-50 border border-navy-100 rounded-lg p-6 text-center text-navy-700">
                {t('myCourses.noEnrolledCourses')}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {enrolledCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    action={
                      <a
                        href={`/courses/${course.id}/chat`}
                        className="inline-flex items-center justify-center w-full px-4 py-2 text-sm font-semibold text-white bg-navy-900 rounded-lg hover:bg-navy-800 transition-colors"
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
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-navy-900">{t('myCourses.discoverNew')}</h2>
              <span className="text-sm text-navy-600">{discoverCourses.length} {t('myCourses.available')}</span>
            </div>
            {discoverCourses.length === 0 ? (
              <div className="bg-navy-50 border border-navy-100 rounded-lg p-6 text-center text-navy-700">
                {t('myCourses.enrolledInAll')}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
          onEnroll={handleEnroll}
        />
      )}
    </main>
  );
}
