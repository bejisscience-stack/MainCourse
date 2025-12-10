'use client';

import { useEffect, useState } from 'react';
import Navigation from '@/components/Navigation';
import BackgroundShapes from '@/components/BackgroundShapes';
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import type { User } from '@supabase/supabase-js';

type CourseType = 'Editing' | 'Content Creation' | 'Website Creation';

interface Course {
  id: string;
  title: string;
  description: string | null;
  course_type: CourseType;
  price: number;
  original_price: number | null;
  author: string;
  creator: string;
  intro_video_url: string | null;
  thumbnail_url: string | null;
  rating: number;
  review_count: number;
  is_bestseller: boolean;
  created_at: string;
  updated_at: string;
}

export default function MyCoursesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  const [discoverCourses, setDiscoverCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
          window.location.href = '/login';
          return;
        }

        // Check if user is a lecturer
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', currentUser.id)
          .single();

        const resolvedRole = profile?.role || currentUser.user_metadata?.role || null;

        // Redirect lecturers to their dashboard
        if (resolvedRole === 'lecturer') {
          window.location.href = '/lecturer/dashboard';
          return;
        }

        setUser(currentUser);
        await fetchCourses(currentUser.id);
      } catch (err: any) {
        setError(err.message || 'Failed to load courses');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const fetchCourses = async (userId: string) => {
    setError(null);
    // Fetch enrollments
    const { data: enrollments, error: enrollError } = await supabase
      .from('enrollments')
      .select('course_id')
      .eq('user_id', userId);

    if (enrollError) {
      throw enrollError;
    }

    const enrolledIds = enrollments?.map((e) => e.course_id) || [];

    // Fetch enrolled courses
    let enrolledData: Course[] = [];
    if (enrolledIds.length > 0) {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .in('id', enrolledIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      enrolledData = data || [];
    }

    // Fetch discover courses (not enrolled)
    let discoverData: Course[] = [];
    if (enrolledIds.length === 0) {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      discoverData = data || [];
    } else {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('created_at', { ascending: false })
        .not('id', 'in', `(${enrolledIds.join(',')})`);
      if (error) throw error;
      discoverData = data || [];
    }

    setEnrolledCourses(enrolledData);
    setDiscoverCourses(discoverData || []);
  };

  const handleEnroll = async (courseId: string) => {
    if (!user) return;
    setError(null);
    setEnrolling(courseId);
    try {
      const { error: insertError } = await supabase
        .from('enrollments')
        .insert([{ user_id: user.id, course_id: courseId }]);
      if (insertError) {
        // Ignore duplicate enroll attempts
        if (insertError.code === '23505') {
          await fetchCourses(user.id);
          return;
        }
        throw insertError;
      }
      await fetchCourses(user.id);
    } catch (err: any) {
      setError(err.message || 'Failed to enroll in course');
    } finally {
      setEnrolling(null);
    }
  };

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

  if (loading) {
    return (
      <main className="relative min-h-screen bg-white overflow-hidden">
        <BackgroundShapes />
        <Navigation />
        <div className="relative z-10 pt-24 pb-16 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-navy-900"></div>
            <p className="mt-4 text-navy-600">Loading your courses...</p>
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
            <h1 className="text-3xl md:text-4xl font-bold text-navy-900 mb-2">My Courses</h1>
            <p className="text-navy-600">See what you’re enrolled in and discover new courses.</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Enrolled courses */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-navy-900">Enrolled</h2>
              <span className="text-sm text-navy-600">{enrolledCourses.length} course(s)</span>
            </div>
            {enrolledCourses.length === 0 ? (
              <div className="bg-navy-50 border border-navy-100 rounded-lg p-6 text-center text-navy-700">
                You haven’t enrolled in any courses yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {enrolledCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    action={
                      <a
                        href={`/courses/${course.id}`}
                        className="inline-flex items-center justify-center w-full px-4 py-2 text-sm font-semibold text-white bg-navy-900 rounded-lg hover:bg-navy-800 transition-colors"
                      >
                        View course
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
              <h2 className="text-xl font-semibold text-navy-900">Discover new courses</h2>
              <span className="text-sm text-navy-600">{discoverCourses.length} available</span>
            </div>
            {discoverCourses.length === 0 ? (
              <div className="bg-navy-50 border border-navy-100 rounded-lg p-6 text-center text-navy-700">
                You’re enrolled in all available courses. Check back later for more!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {discoverCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    action={
                      <button
                        onClick={() => handleEnroll(course.id)}
                        disabled={enrolling === course.id}
                        className="inline-flex items-center justify-center w-full px-4 py-2 text-sm font-semibold text-white bg-navy-900 rounded-lg hover:bg-navy-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {enrolling === course.id ? 'Enrolling...' : 'Enroll'}
                      </button>
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

