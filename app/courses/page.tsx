'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import CourseCard, { type Course } from '@/components/CourseCard';
import BackgroundShapes from '@/components/BackgroundShapes';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';
import { useCourses } from '@/hooks/useCourses';
import { useEnrollments } from '@/hooks/useEnrollments';
import useSWR from 'swr';

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
  const [filter, setFilter] = useState<FilterType>('All');
  const [enrollingCourseId, setEnrollingCourseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { user, role: userRole, isLoading: userLoading } = useUser();
  const { courses, isLoading: coursesLoading, mutate: mutateCourses } = useCourses(filter);
  const { enrolledCourseIds, mutate: mutateEnrollments } = useEnrollments(user?.id || null);

  // Fetch lecturer courses if user is lecturer
  const { data: lecturerCourseIds = new Set<string>() } = useSWR<Set<string>>(
    userRole === 'lecturer' && user ? ['lecturer-courses', user.id] : null,
    () => fetchLecturerCourses(user!.id),
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  );

  // Redirect lecturers immediately
  useEffect(() => {
    if (!userLoading && userRole === 'lecturer') {
      router.push('/lecturer/dashboard');
    }
  }, [userRole, userLoading, router]);

  // Filter courses based on user role
  const filteredCourses = useMemo(() => {
    let result = courses;

    // Filter by course type
    if (filter !== 'All') {
      result = result.filter((course) => course.course_type === filter);
    }

    // Filter out lecturer's own courses
    if (userRole === 'lecturer' && lecturerCourseIds.size > 0) {
      result = result.filter((course) => !lecturerCourseIds.has(course.id));
    }

    return result;
  }, [courses, filter, userRole, lecturerCourseIds]);

  const handleEnroll = useCallback(async (courseId: string) => {
    if (!user) {
      router.push('/login?redirect=/courses');
      return;
    }

    if (userRole === 'lecturer') {
      setError('Lecturers cannot enroll in courses. Please use your dashboard to manage your courses.');
      return;
    }

    if (lecturerCourseIds.has(courseId)) {
      setError('You cannot enroll in your own course.');
      return;
    }

    // Prevent duplicate enrollment attempts
    if (enrolledCourseIds.has(courseId)) {
      setError('You are already enrolled in this course');
      return;
    }

    setError(null);
    setEnrollingCourseId(courseId);

    try {
      // Perform the actual enrollment with verification
      const { data: insertedData, error: insertError } = await supabase
        .from('enrollments')
        .insert([{ user_id: user.id, course_id: courseId }])
        .select()
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          // Already enrolled, refresh enrollments
          await mutateEnrollments();
          return;
        }
        throw insertError;
      }

      // Verify we got exactly one enrollment back for the correct course
      if (insertedData && insertedData.course_id === courseId) {
        // Update enrollments cache
        await mutateEnrollments();
      } else {
        throw new Error('Enrollment verification failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to enroll in course');
      console.error('Error enrolling in course:', err);
      // Revalidate to get correct state
      await mutateEnrollments();
    } finally {
      setEnrollingCourseId(null);
    }
  }, [user, userRole, lecturerCourseIds, enrolledCourseIds, mutateEnrollments, router]);

  const courseTypes: FilterType[] = ['All', 'Editing', 'Content Creation', 'Website Creation'];

  const isLoading = userLoading || coursesLoading;

  return (
    <main className="relative min-h-screen bg-white overflow-hidden">
      <BackgroundShapes />
      <Navigation />
      <div className="relative z-10 pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-navy-900 mb-4">
              Our Courses
            </h1>
            <p className="text-lg text-navy-600 max-w-2xl mx-auto">
              Discover our comprehensive collection of courses designed to help you master new skills
            </p>
          </div>

          {/* Filter Buttons */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {courseTypes.map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                  filter === type
                    ? 'bg-navy-900 text-white'
                    : 'bg-navy-50 text-navy-700 hover:bg-navy-100'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Loading State with Skeleton */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg overflow-hidden shadow-md border border-gray-100 animate-pulse">
                  <div className="w-full h-48 bg-gradient-to-br from-gray-200 to-gray-300"></div>
                  <div className="p-4 space-y-3">
                    <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    <div className="flex gap-2">
                      <div className="h-5 bg-gray-200 rounded w-20"></div>
                      <div className="h-5 bg-gray-200 rounded w-16"></div>
                    </div>
                    <div className="h-6 bg-gray-200 rounded w-24"></div>
                    <div className="h-10 bg-gray-200 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="text-center py-12">
              <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg inline-block max-w-md">
                <p className="font-semibold">Error loading courses</p>
                <p className="text-sm mt-1 mb-4">{error}</p>
                <button
                  onClick={() => {
                    setError(null);
                    mutateCourses();
                  }}
                  className="bg-navy-900 text-white px-4 py-2 rounded-lg font-semibold hover:bg-navy-800 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Courses Grid */}
          {!isLoading && !error && (
            <>
              {filteredCourses.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-navy-600 text-lg">
                    No courses found{filter !== 'All' ? ` in ${filter}` : ''}.
                  </p>
                </div>
              ) : (
                <>
                  {error && (
                    <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm text-center">
                      {error}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredCourses.map((course) => {
                      const isOwnCourse = lecturerCourseIds.has(course.id);
                      const shouldShowEnroll = !isOwnCourse && userRole !== 'lecturer';
                      
                      return (
                        <CourseCard
                          key={course.id}
                          course={course}
                          isEnrolled={enrolledCourseIds.has(course.id)}
                          isEnrolling={enrollingCourseId === course.id}
                          onEnroll={shouldShowEnroll ? handleEnroll : undefined}
                          showEnrollButton={shouldShowEnroll}
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
