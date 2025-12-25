'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import CourseCard, { type Course } from '@/components/CourseCard';
import CourseEnrollmentCard from '@/components/CourseEnrollmentCard';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';
import { useCourses } from '@/hooks/useCourses';
import { useEnrollments } from '@/hooks/useEnrollments';
import { useEnrollmentRequestStatus } from '@/hooks/useEnrollmentRequests';
import useSWR from 'swr';
import { useI18n } from '@/contexts/I18nContext';

type FilterType = 'All' | 'Editing' | 'Content Creation' | 'Website Creation';

// Fetcher for lecturer courses
async function fetchLecturerCourses(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('courses')
    .select('id')
    .eq('lecturer_id', userId);
  return new Set(data?.map((c) => c.id) || []);
}

export default function CoursesPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [filter, setFilter] = useState<FilterType>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [enrollingCourseId, setEnrollingCourseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { user, role: userRole, isLoading: userLoading } = useUser();
  const { courses, isLoading: coursesLoading, mutate: mutateCourses } = useCourses(filter);
  const { enrolledCourseIds, mutate: mutateEnrollments } = useEnrollments(user?.id || null);
  const [bundles, setBundles] = useState<any[]>([]);
  const [enrolledBundleIds, setEnrolledBundleIds] = useState<Set<string>>(new Set());

  // Fetch lecturer courses if user is lecturer
  const { data: lecturerCourseIds = new Set<string>() } = useSWR<Set<string>>(
    userRole === 'lecturer' && user ? ['lecturer-courses', user.id] : null,
    () => fetchLecturerCourses(user!.id),
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  );

  // Fetch bundles using SWR for caching and deduplication
  const { data: bundlesData = [], isLoading: bundlesLoading } = useSWR(
    'course-bundles',
    async () => {
      const { data, error } = await supabase
        .from('course_bundles')
        .select(`
          *,
          course_bundle_items (
            course_id,
            courses (
              id,
              title,
              price,
              thumbnail_url
            )
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // Cache for 30 seconds
    }
  );

  // Fetch enrolled bundles using SWR
  const { data: enrolledBundlesData = [] } = useSWR<{ bundle_id: string }[]>(
    user?.id ? ['bundle-enrollments', user.id] : null,
    async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('bundle_enrollments')
        .select('bundle_id')
        .eq('user_id', user.id);

      if (error) throw error;
      return data || [];
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  );

  // Update state from SWR data
  useEffect(() => {
    setBundles(bundlesData);
  }, [bundlesData]);

  useEffect(() => {
    setEnrolledBundleIds(new Set(enrolledBundlesData.map(b => b.bundle_id)));
  }, [enrolledBundlesData]);

  // Redirect lecturers immediately (but not admins)
  useEffect(() => {
    if (!userLoading && userRole === 'lecturer') {
      router.push('/lecturer/dashboard');
    }
    // Admins can view all courses, so don't redirect them
  }, [userRole, userLoading, router]);

  // Filter courses based on user role, filter type, and search query
  const filteredCourses = useMemo(() => {
    let result = courses;

    // Filter by course type
    if (filter !== 'All') {
      result = result.filter((course) => course.course_type === filter);
    }

    // Filter by search query (course name or lecturer/creator name)
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter((course) => {
        const titleMatch = course.title?.toLowerCase().includes(query);
        const creatorMatch = course.creator?.toLowerCase().includes(query);
        const authorMatch = course.author?.toLowerCase().includes(query);
        return titleMatch || creatorMatch || authorMatch;
      });
    }

    // Filter out lecturer's own courses
    if (userRole === 'lecturer' && lecturerCourseIds.size > 0) {
      result = result.filter((course) => !lecturerCourseIds.has(course.id));
    }

    return result;
  }, [courses, filter, searchQuery, userRole, lecturerCourseIds]);

  const handleEnroll = useCallback(async (courseId: string) => {
    if (!user) {
      router.push('/login?redirect=/courses');
      return;
    }

    if (userRole === 'lecturer') {
      setError(t('courses.lecturersCannotEnroll'));
      return;
    }

    if (lecturerCourseIds.has(courseId)) {
      setError(t('courses.cannotEnrollOwnCourse'));
      return;
    }

    // Prevent duplicate enrollment attempts
    if (enrolledCourseIds.has(courseId)) {
      setError(t('courses.alreadyEnrolled'));
      return;
    }

    setError(null);
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
        throw new Error(result.error || t('courses.errorRequestingEnrollment'));
      }

      // Success - revalidate enrollment requests
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Failed to request enrollment');
      console.error('Error requesting enrollment:', err);
    } finally {
      setEnrollingCourseId(null);
    }
  }, [user, userRole, lecturerCourseIds, enrolledCourseIds, router]);

  const courseTypes: FilterType[] = ['All', 'Editing', 'Content Creation', 'Website Creation'];

  const isLoading = userLoading || coursesLoading;

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-[#fafafa] to-white dark:from-navy-950 dark:to-navy-900 overflow-hidden">
      {/* Base gradient layer */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#fafafa] via-white to-[#fafafa] dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 pointer-events-none"></div>
      
      <Navigation />
      <div className="relative z-10 pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-charcoal-950 dark:text-white mb-4">
              {t('courses.ourCourses')}
            </h1>
            <p className="text-lg text-charcoal-600 dark:text-gray-400 max-w-2xl mx-auto">
              {t('courses.discoverCourses')}
            </p>
          </div>

          {/* Search Bar */}
          <div className="mb-8 max-w-2xl mx-auto">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('courses.searchPlaceholder') || 'Search by course name or lecturer name...'}
                className="w-full pl-12 pr-4 py-3 bg-white dark:bg-navy-800 border-2 border-gray-200 dark:border-navy-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent text-charcoal-950 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  aria-label="Clear search"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Filter Buttons */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {courseTypes.map((type) => {
              const filterKey = type === 'All' ? 'filterAll' : 
                               type === 'Editing' ? 'filterEditing' :
                               type === 'Content Creation' ? 'filterContentCreation' : 'filterWebsiteCreation';
              return (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                    filter === type
                      ? 'bg-charcoal-950 dark:bg-emerald-500 text-white dark:text-white'
                      : 'bg-charcoal-50 dark:bg-navy-800 text-charcoal-700 dark:text-gray-300 hover:bg-charcoal-100 dark:hover:bg-navy-700'
                  }`}
                >
                  {t(`courses.${filterKey}`)}
                </button>
              );
            })}
          </div>

          {/* Loading State with Skeleton */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-navy-800 rounded-lg overflow-hidden shadow-md border border-gray-100 dark:border-navy-700 animate-pulse">
                  <div className="w-full h-48 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-navy-700 dark:to-navy-600"></div>
                  <div className="p-4 space-y-3">
                    <div className="h-6 bg-gray-200 dark:bg-navy-700 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 dark:bg-navy-700 rounded w-1/2"></div>
                    <div className="flex gap-2">
                      <div className="h-5 bg-gray-200 dark:bg-navy-700 rounded w-20"></div>
                      <div className="h-5 bg-gray-200 dark:bg-navy-700 rounded w-16"></div>
                    </div>
                    <div className="h-6 bg-gray-200 dark:bg-navy-700 rounded w-24"></div>
                    <div className="h-10 bg-gray-200 dark:bg-navy-700 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="text-center py-12">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-6 py-4 rounded-lg inline-block max-w-md">
                <p className="font-semibold">{t('home.errorLoadingCourses')}</p>
                <p className="text-sm mt-1 mb-4">{error}</p>
                <button
                  onClick={() => {
                    setError(null);
                    mutateCourses();
                  }}
                  className="bg-charcoal-950 dark:bg-emerald-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-charcoal-800 dark:hover:bg-emerald-600 transition-colors"
                >
                  {t('common.tryAgain')}
                </button>
              </div>
            </div>
          )}

          {/* Bundles Section */}
          {bundles.length > 0 && (
            <div className="mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-charcoal-950 dark:text-white mb-6">{t('courses.courseBundles')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                {bundles.map((bundle) => {
                  const bundleCourses = bundle.course_bundle_items?.map((item: any) => item.courses).filter(Boolean) || [];
                  const totalOriginalPrice = bundleCourses.reduce((sum: number, course: any) => sum + (course?.price || 0), 0);
                  const isEnrolled = enrolledBundleIds.has(bundle.id);
                  
                  return (
                    <div key={bundle.id} className="bg-white dark:bg-navy-800 border-2 border-emerald-200 dark:border-emerald-700/50 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide bg-emerald-50 dark:bg-emerald-500/20 px-2 py-1 rounded">{t('courses.bundle')}</span>
                        </div>
                        <h3 className="text-lg font-bold text-charcoal-950 dark:text-white mb-2">{bundle.title}</h3>
                        {bundle.description && (
                          <p className="text-sm text-charcoal-600 dark:text-gray-400 line-clamp-2">{bundle.description}</p>
                        )}
                      </div>
                      <div className="mb-4">
                        <p className="text-xs text-charcoal-500 dark:text-gray-500 mb-2">{t('courses.includesCourses', { count: bundleCourses.length })}</p>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {bundleCourses.map((course: any, idx: number) => (
                            <div key={idx} className="flex items-center text-sm text-charcoal-700 dark:text-gray-300">
                              <svg className="w-4 h-4 mr-1 text-emerald-600 dark:text-emerald-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              <span className="truncate">{course?.title || t('courses.unknownCourse')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mb-4 pt-4 border-t border-emerald-100 dark:border-emerald-800/50">
                        <div>
                          <p className="text-xs text-charcoal-500 dark:text-gray-500">{t('courses.bundlePrice')}</p>
                          <p className="text-xl font-bold text-charcoal-950 dark:text-white">
                            ${bundle.price.toFixed(2)}
                          </p>
                          {totalOriginalPrice > bundle.price && (
                            <p className="text-xs text-charcoal-400 dark:text-gray-500 line-through">
                              ${totalOriginalPrice.toFixed(2)} {t('courses.total')}
                            </p>
                          )}
                        </div>
                      </div>
                      {isEnrolled ? (
                        <a
                          href={`/my-courses`}
                          className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-emerald-500 rounded-full hover:bg-emerald-600 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {t('courses.viewCourses')}
                        </a>
                      ) : (
                        <button
                          onClick={() => {
                            // Check if user is authenticated before navigating to bundle enrollment
                            if (!user) {
                              router.push(`/login?redirect=${encodeURIComponent(`/bundles/${bundle.id}`)}`);
                              return;
                            }
                            router.push(`/bundles/${bundle.id}`);
                          }}
                          className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-emerald-500 dark:bg-emerald-500 rounded-full hover:bg-emerald-600 dark:hover:bg-emerald-600 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          {t('courses.enrollInBundle')}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Courses Grid */}
          {!isLoading && !error && (
            <>
              <h2 className="text-2xl md:text-3xl font-bold text-charcoal-950 dark:text-white mb-6">{t('courses.individualCourses')}</h2>
              {filteredCourses.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-charcoal-600 dark:text-gray-400 text-lg">
                    {searchQuery ? (
                      t('courses.noCoursesFoundForSearch', { query: searchQuery })
                    ) : filter !== 'All' ? (
                      t('courses.noCoursesInCategory', { category: filter === 'Editing' ? t('courses.filterEditing') : filter === 'Content Creation' ? t('courses.filterContentCreation') : t('courses.filterWebsiteCreation') })
                    ) : (
                      t('courses.noCoursesFound')
                    )}
                  </p>
                </div>
              ) : (
                <>
                  {error && (
                    <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm text-center">
                      {error}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredCourses.map((course) => {
                      const isOwnCourse = lecturerCourseIds.has(course.id);
                      const shouldShowEnroll = !isOwnCourse && userRole !== 'lecturer';
                      
                      return (
                        <CourseEnrollmentCard
                          key={course.id}
                          course={course}
                          isEnrolled={enrolledCourseIds.has(course.id)}
                          isEnrolling={false}
                          onEnroll={undefined}
                          showEnrollButton={shouldShowEnroll}
                          userId={user?.id || null}
                        />
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
