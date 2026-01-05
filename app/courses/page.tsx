'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import FirstLoginCoursePopup from '@/components/FirstLoginCoursePopup';
import { formatPriceInGel } from '@/lib/currency';

type FilterType = 'All' | 'Editing' | 'Content Creation' | 'Website Creation';

// Fetcher for lecturer courses
async function fetchLecturerCourses(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('courses')
    .select('id')
    .eq('lecturer_id', userId);
  return new Set(data?.map((c) => c.id) || []);
}

function CoursesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const [filter, setFilter] = useState<FilterType>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [enrollingCourseId, setEnrollingCourseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [urlReferralCode, setUrlReferralCode] = useState<string | null>(null);

  const { user, profile, role: userRole, isLoading: userLoading } = useUser();

  // Read URL params for course and referral code
  useEffect(() => {
    const courseParam = searchParams.get('course');
    const refParam = searchParams.get('ref');
    if (courseParam) {
      setSelectedCourseId(courseParam);
    }
    if (refParam) {
      setUrlReferralCode(refParam.toUpperCase().trim());
    }
  }, [searchParams]);
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

  // Separate enrolled and available courses
  const { enrolledCourses, availableCourses } = useMemo(() => {
    const enrolled = filteredCourses.filter(course => enrolledCourseIds.has(course.id));
    const available = filteredCourses.filter(course => !enrolledCourseIds.has(course.id));
    return { enrolledCourses: enrolled, availableCourses: available };
  }, [filteredCourses, enrolledCourseIds]);

  // Check if any filters are active
  const hasActiveFilters = filter !== 'All' || searchQuery.trim() !== '';

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setFilter('All');
    setSearchQuery('');
  }, []);

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
    <main className="relative bg-gradient-to-b from-[#fafafa] to-white dark:from-navy-950 dark:to-navy-900 overflow-hidden min-h-screen">
      {/* Base gradient layer */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#fafafa] via-white to-[#fafafa] dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 pointer-events-none"></div>

      <Navigation />
      <div className="relative z-10 pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-bold text-charcoal-950 dark:text-white mb-4">
              {t('courses.ourCourses')}
            </h1>
            <p className="text-lg text-charcoal-600 dark:text-gray-400 max-w-2xl mx-auto">
              {t('courses.discoverCourses')}
            </p>
          </div>

          {/* Search and Filter Section */}
          <div className="bg-white/50 dark:bg-navy-800/50 backdrop-blur-sm rounded-2xl border border-charcoal-100/50 dark:border-navy-700/50 p-6 mb-10 shadow-soft">
            {/* Search Bar */}
            <div className="max-w-2xl mx-auto mb-5">
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
                  className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-navy-900 border-2 border-gray-200 dark:border-navy-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent text-charcoal-950 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 shadow-sm"
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
            <div className="flex flex-wrap justify-center items-center gap-3">
              {courseTypes.map((type) => {
                const filterKey = type === 'All' ? 'filterAll' :
                                 type === 'Editing' ? 'filterEditing' :
                                 type === 'Content Creation' ? 'filterContentCreation' : 'filterWebsiteCreation';
                return (
                  <button
                    key={type}
                    onClick={() => setFilter(type)}
                    className={`px-5 py-2.5 rounded-xl font-medium transition-all duration-200 ${
                      filter === type
                        ? 'bg-charcoal-950 dark:bg-emerald-500 text-white shadow-md'
                        : 'bg-white dark:bg-navy-700 text-charcoal-700 dark:text-gray-300 hover:bg-charcoal-50 dark:hover:bg-navy-600 border border-charcoal-200 dark:border-navy-600'
                    }`}
                  >
                    {t(`courses.${filterKey}`)}
                  </button>
                );
              })}
              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="px-4 py-2.5 rounded-xl font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {t('courses.clearFilters')}
                </button>
              )}
            </div>
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

          {/* My Enrolled Courses Section - Only show if user has enrolled courses */}
          {!isLoading && !error && user && enrolledCourses.length > 0 && (
            <section className="mb-12">
              {/* Section Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-500/20 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-charcoal-950 dark:text-white">
                      {t('courses.myEnrolledCourses')}
                    </h2>
                    <p className="text-sm text-charcoal-500 dark:text-gray-400 mt-0.5">
                      {t('courses.enrolledCoursesDescription')}
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center px-3 py-1.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm font-medium rounded-full">
                  {enrolledCourses.length === 1
                    ? t('courses.courseCount', { count: enrolledCourses.length })
                    : t('courses.coursesCount', { count: enrolledCourses.length })}
                </span>
              </div>

              {/* Enrolled Courses Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {enrolledCourses.map((course) => {
                  const isOwnCourse = lecturerCourseIds.has(course.id);
                  const shouldShowEnroll = !isOwnCourse && userRole !== 'lecturer';

                  return (
                    <CourseEnrollmentCard
                      key={course.id}
                      course={course}
                      isEnrolled={true}
                      isEnrolling={false}
                      onEnroll={undefined}
                      showEnrollButton={shouldShowEnroll}
                      userId={user?.id || null}
                    />
                  );
                })}
              </div>
            </section>
          )}

          {/* Bundles Section */}
          {bundles.length > 0 && (
            <section className="mb-12">
              {/* Section Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-500/20 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-charcoal-950 dark:text-white">
                      {t('courses.courseBundles')}
                    </h2>
                    <p className="text-sm text-charcoal-500 dark:text-gray-400 mt-0.5">
                      {t('courses.bundlesDescription')}
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center px-3 py-1.5 bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 text-sm font-medium rounded-full">
                  {bundles.length === 1
                    ? t('courses.bundleCount', { count: bundles.length })
                    : t('courses.bundlesCount', { count: bundles.length })}
                </span>
              </div>

              {/* Bundles Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {bundles.map((bundle) => {
                  const bundleCourses = bundle.course_bundle_items?.map((item: any) => item.courses).filter(Boolean) || [];
                  const totalOriginalPrice = bundleCourses.reduce((sum: number, course: any) => sum + (course?.price || 0), 0);
                  const isEnrolled = enrolledBundleIds.has(bundle.id);

                  return (
                    <div key={bundle.id} className="h-full flex flex-col bg-white dark:bg-navy-800 border-2 border-purple-200 dark:border-purple-700/50 rounded-2xl overflow-hidden shadow-soft hover:shadow-soft-lg transition-all duration-200">
                      {/* Bundle Header with gradient */}
                      <div className="bg-gradient-to-r from-purple-500/10 to-emerald-500/10 dark:from-purple-500/20 dark:to-emerald-500/20 p-5 border-b border-purple-100 dark:border-purple-800/50">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide bg-purple-100 dark:bg-purple-500/30 px-2.5 py-1 rounded-md">{t('courses.bundle')}</span>
                          {totalOriginalPrice > bundle.price && (
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 px-2 py-1 rounded-md">
                              Save {Math.round(((totalOriginalPrice - bundle.price) / totalOriginalPrice) * 100)}%
                            </span>
                          )}
                        </div>
                        <h3 className="text-lg font-bold text-charcoal-950 dark:text-white line-clamp-2">{bundle.title}</h3>
                        {bundle.description && (
                          <p className="text-sm text-charcoal-600 dark:text-gray-400 line-clamp-2 mt-2">{bundle.description}</p>
                        )}
                      </div>

                      {/* Bundle Content */}
                      <div className="flex-1 p-5">
                        <p className="text-xs font-medium text-charcoal-500 dark:text-gray-500 mb-3">{t('courses.includesCourses', { count: bundleCourses.length })}</p>
                        <div className="space-y-2 max-h-28 overflow-y-auto">
                          {bundleCourses.map((course: any, idx: number) => (
                            <div key={idx} className="flex items-center text-sm text-charcoal-700 dark:text-gray-300">
                              <svg className="w-4 h-4 mr-2 text-emerald-500 dark:text-emerald-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              <span className="truncate">{course?.title || t('courses.unknownCourse')}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Bundle Footer */}
                      <div className="mt-auto p-5 pt-0">
                        <div className="flex items-center justify-between mb-4 pt-4 border-t border-purple-100 dark:border-purple-800/50">
                          <div>
                            <p className="text-xs text-charcoal-500 dark:text-gray-500">{t('courses.bundlePrice')}</p>
                            <p className="text-2xl font-bold text-charcoal-950 dark:text-white">
                              {formatPriceInGel(bundle.price)}
                            </p>
                            {totalOriginalPrice > bundle.price && (
                              <p className="text-xs text-charcoal-400 dark:text-gray-500 line-through">
                                {formatPriceInGel(totalOriginalPrice)} {t('courses.total')}
                              </p>
                            )}
                          </div>
                        </div>
                        {isEnrolled ? (
                          <a
                            href={`/my-courses`}
                            className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-white bg-emerald-500 rounded-xl hover:bg-emerald-600 transition-colors"
                          >
                            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            {t('courses.viewCourses')}
                          </a>
                        ) : (
                          <button
                            onClick={() => {
                              if (!user) {
                                router.push(`/login?redirect=${encodeURIComponent(`/bundles/${bundle.id}`)}`);
                                return;
                              }
                              router.push(`/bundles/${bundle.id}`);
                            }}
                            className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-white bg-purple-600 dark:bg-purple-500 rounded-xl hover:bg-purple-700 dark:hover:bg-purple-600 transition-colors"
                          >
                            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            {t('courses.enrollInBundle')}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Available Courses Section */}
          {!isLoading && !error && (
            <section>
              {/* Section Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-cyan-100 dark:bg-cyan-500/20 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-cyan-600 dark:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-charcoal-950 dark:text-white">
                      {t('courses.availableCourses')}
                    </h2>
                    <p className="text-sm text-charcoal-500 dark:text-gray-400 mt-0.5">
                      {t('courses.availableCoursesDescription')}
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center px-3 py-1.5 bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 text-sm font-medium rounded-full">
                  {availableCourses.length === 1
                    ? t('courses.courseCount', { count: availableCourses.length })
                    : t('courses.coursesCount', { count: availableCourses.length })}
                </span>
              </div>

              {/* Empty State for no available courses */}
              {availableCourses.length === 0 && filteredCourses.length === 0 ? (
                <div className="text-center py-16 bg-white/50 dark:bg-navy-800/50 rounded-2xl border border-charcoal-100/50 dark:border-navy-700/50">
                  <div className="w-16 h-16 bg-charcoal-100 dark:bg-navy-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-charcoal-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-charcoal-600 dark:text-gray-400 text-lg mb-2">
                    {searchQuery ? (
                      t('courses.noCoursesFoundForSearch', { query: searchQuery })
                    ) : filter !== 'All' ? (
                      t('courses.noCoursesInCategory', { category: filter === 'Editing' ? t('courses.filterEditing') : filter === 'Content Creation' ? t('courses.filterContentCreation') : t('courses.filterWebsiteCreation') })
                    ) : (
                      t('courses.noCoursesFound')
                    )}
                  </p>
                  {hasActiveFilters && (
                    <button
                      onClick={handleClearFilters}
                      className="mt-4 px-5 py-2.5 bg-charcoal-950 dark:bg-emerald-500 text-white rounded-xl font-medium hover:bg-charcoal-800 dark:hover:bg-emerald-600 transition-colors"
                    >
                      {t('courses.clearFilters')}
                    </button>
                  )}
                </div>
              ) : availableCourses.length === 0 && enrolledCourses.length > 0 ? (
                /* User is enrolled in all filtered courses */
                <div className="text-center py-16 bg-emerald-50/50 dark:bg-emerald-500/10 rounded-2xl border border-emerald-200/50 dark:border-emerald-700/30">
                  <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-charcoal-700 dark:text-gray-300 text-lg font-medium">
                    {t('myCourses.enrolledInAll')}
                  </p>
                </div>
              ) : (
                /* Available Courses Grid */
                <>
                  {error && (
                    <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm text-center">
                      {error}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {availableCourses.map((course) => {
                      const isOwnCourse = lecturerCourseIds.has(course.id);
                      const shouldShowEnroll = !isOwnCourse && userRole !== 'lecturer';
                      const isSelectedCourse = selectedCourseId === course.id;

                      return (
                        <CourseEnrollmentCard
                          key={course.id}
                          course={course}
                          isEnrolled={false}
                          isEnrolling={false}
                          onEnroll={undefined}
                          showEnrollButton={shouldShowEnroll}
                          userId={user?.id || null}
                          initialReferralCode={isSelectedCourse ? urlReferralCode : null}
                          autoOpen={isSelectedCourse && shouldShowEnroll}
                        />
                      );
                    })}
                  </div>
                </>
              )}
            </section>
          )}
        </div>
      </div>
      {/* First Login Course Popup */}
      {!userLoading && 
       user && 
       profile && 
       profile.referred_for_course_id && 
       profile.signup_referral_code && 
       !profile.first_login_completed &&
       userRole !== 'lecturer' && (
        <FirstLoginCoursePopup
          courseId={profile.referred_for_course_id}
          referralCode={profile.signup_referral_code}
        />
      )}
    </main>
  );
}

export default function CoursesPage() {
  return (
    <Suspense fallback={
      <main className="relative bg-gradient-to-b from-[#fafafa] to-white dark:from-navy-950 dark:to-navy-900 overflow-hidden">
        <div className="flex items-center justify-center min-h-screen">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
        </div>
      </main>
    }>
      <CoursesPageContent />
    </Suspense>
  );
}
