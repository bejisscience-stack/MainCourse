'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Navigation from '@/components/Navigation';
import CourseCard, { type Course } from '@/components/CourseCard';
import BackgroundShapes from '@/components/BackgroundShapes';
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import type { User } from '@supabase/supabase-js';

const REQUEST_TIMEOUT = 10000; // 10 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'All' | 'Editing' | 'Content Creation' | 'Website Creation'>('All');
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [lecturerCourseIds, setLecturerCourseIds] = useState<Set<string>>(new Set());
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(new Set());
  const [enrollingCourseId, setEnrollingCourseId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchCourses = useCallback(async (retryCount = 0) => {
    // Cancel previous request if it exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      setLoading(true);
      setError(null);

      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Request timeout: The request took too long to complete'));
        }, REQUEST_TIMEOUT);
        
        // Clear timeout if request is aborted
        abortController.signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
        });
      });

      // Build query
      let query = supabase
        .from('courses')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100); // Limit results for better performance

      if (filter !== 'All') {
        query = query.eq('course_type', filter);
      }

      // Execute query with timeout
      const queryPromise = query;
      
      const result = await Promise.race([
        queryPromise.then(result => {
          if (abortController.signal.aborted) {
            throw new Error('Request cancelled');
          }
          return result;
        }),
        timeoutPromise,
      ]);

      const { data, error: fetchError } = result as { data: Course[] | null; error: any };

      // Check if request was aborted
      if (abortController.signal.aborted) {
        return;
      }

      if (fetchError) {
        throw fetchError;
      }

      // Filter out courses created by lecturer if user is a lecturer
      let filteredCourses = data || [];
      if (userRole === 'lecturer' && lecturerCourseIds.size > 0) {
        filteredCourses = filteredCourses.filter(
          (course) => !lecturerCourseIds.has(course.id)
        );
      }

      setCourses(filteredCourses);
    } catch (err: any) {
      // Don't set error if request was aborted
      if (abortController.signal.aborted) {
        return;
      }

      // Retry logic for network errors or timeouts
      if (retryCount < MAX_RETRIES && (err.message?.includes('timeout') || err.message?.includes('network') || err.code === 'PGRST116' || err.message?.includes('fetch'))) {
        console.warn(`Retry attempt ${retryCount + 1}/${MAX_RETRIES} after error:`, err.message);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
        return fetchCourses(retryCount + 1);
      }

      setError(err.message || 'Failed to load courses. Please try again.');
      console.error('Error fetching courses:', err);
    } finally {
      // Only update loading state if request wasn't aborted
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }
  }, [filter]);

  useEffect(() => {
    // Check if user is logged in and their role
    const checkUser = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        
        if (currentUser) {
          // Check user role
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', currentUser.id)
            .single();

          const resolvedRole = profile?.role || currentUser.user_metadata?.role || null;
          setUserRole(resolvedRole);

          // If lecturer, redirect to dashboard
          if (resolvedRole === 'lecturer') {
            window.location.href = '/lecturer/dashboard';
            return;
          }

          // Fetch lecturer's courses to filter them out
          const { data: lecturerCourses } = await supabase
            .from('courses')
            .select('id')
            .eq('lecturer_id', currentUser.id);

          if (lecturerCourses) {
            setLecturerCourseIds(new Set(lecturerCourses.map((c) => c.id)));
          }

          await fetchEnrollments(currentUser.id);
        }
      } catch (err) {
        console.error('Error checking user:', err);
      }
    };
    
    checkUser();
    fetchCourses();
    
    // Cleanup: cancel ongoing request when component unmounts or filter changes
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchCourses]);

  const fetchEnrollments = async (userId: string) => {
    try {
      const { data: enrollments, error: enrollError } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('user_id', userId);

      if (enrollError) {
        console.error('Error fetching enrollments:', enrollError);
        return;
      }

      const enrolledIds = new Set(enrollments?.map((e) => e.course_id) || []);
      setEnrolledCourseIds(enrolledIds);
    } catch (err) {
      console.error('Error fetching enrollments:', err);
    }
  };

  const handleEnroll = async (courseId: string) => {
    // Check if user is logged in
    if (!user) {
      // Redirect to login page
      window.location.href = '/login?redirect=/courses';
      return;
    }

    // Prevent lecturers from enrolling
    if (userRole === 'lecturer') {
      setError('Lecturers cannot enroll in courses. Please use your dashboard to manage your courses.');
      return;
    }

    // Check if this is the lecturer's own course
    if (lecturerCourseIds.has(courseId)) {
      setError('You cannot enroll in your own course.');
      return;
    }

    // Double-check: verify course doesn't belong to this user
    const { data: course } = await supabase
      .from('courses')
      .select('lecturer_id')
      .eq('id', courseId)
      .single();

    if (course && course.lecturer_id === user.id) {
      setError('You cannot enroll in your own course.');
      return;
    }

    setError(null);
    setEnrollingCourseId(courseId);

    try {
      const { error: insertError } = await supabase
        .from('enrollments')
        .insert([{ user_id: user.id, course_id: courseId }]);

      if (insertError) {
        // Ignore duplicate enroll attempts
        if (insertError.code === '23505') {
          // Already enrolled, refresh enrollments
          await fetchEnrollments(user.id);
          return;
        }
        throw insertError;
      }

      // Update enrolled courses
      setEnrolledCourseIds((prev) => new Set([...prev, courseId]));
    } catch (err: any) {
      setError(err.message || 'Failed to enroll in course');
      console.error('Error enrolling in course:', err);
    } finally {
      setEnrollingCourseId(null);
    }
  };

  const courseTypes: Array<'All' | 'Editing' | 'Content Creation' | 'Website Creation'> = [
    'All',
    'Editing',
    'Content Creation',
    'Website Creation',
  ];

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

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-navy-900"></div>
              <p className="mt-4 text-navy-600">Loading courses...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="text-center py-12">
              <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg inline-block max-w-md">
                <p className="font-semibold">Error loading courses</p>
                <p className="text-sm mt-1 mb-4">{error}</p>
                <button
                  onClick={() => fetchCourses()}
                  className="bg-navy-900 text-white px-4 py-2 rounded-lg font-semibold hover:bg-navy-800 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Courses Grid */}
          {!loading && !error && (
            <>
              {courses.length === 0 ? (
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
                    {courses.map((course) => {
                      // Don't show enroll button if user is lecturer or if course belongs to lecturer
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

