'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CourseCard, { type Course } from '@/components/CourseCard';
import CourseEnrollmentCard from '@/components/CourseEnrollmentCard';
import { useCourses } from '@/hooks/useCourses';
import { useEnrollments } from '@/hooks/useEnrollments';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';

export default function CoursesCarousel() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [enrollingCourseId, setEnrollingCourseId] = useState<string | null>(null);
  const { user, role: userRole } = useUser();
  const { courses, isLoading } = useCourses('All');
  const { enrolledCourseIds, mutate: mutateEnrollments } = useEnrollments(user?.id || null);

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

  if (isLoading) {
    return (
      <section className="px-4 sm:px-6 lg:px-8 pb-24 md:pb-32">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-navy-900 text-center mb-12">
            Our Courses
          </h2>
          <div className="flex items-center justify-center">
            <div className="text-navy-700">Loading courses...</div>
          </div>
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
        <h2 className="text-3xl md:text-4xl font-bold text-navy-900 text-center mb-12">
          Our Courses
        </h2>
        
        <div className="relative">
          {/* Navigation Arrows - Show when we have 3+ courses */}
          {showArrows && (
            <>
              <button
                onClick={handlePrevious}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-8 z-20 w-12 h-12 md:w-14 md:h-14 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-navy-50 transition-all transform hover:scale-110 active:scale-95 border border-gray-200"
                aria-label="Previous course"
              >
                <svg
                  className="w-6 h-6 md:w-7 md:h-7 text-navy-900"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>

              <button
                onClick={handleNext}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-8 z-20 w-12 h-12 md:w-14 md:h-14 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-navy-50 transition-all transform hover:scale-110 active:scale-95 border border-gray-200"
                aria-label="Next course"
              >
                <svg
                  className="w-6 h-6 md:w-7 md:h-7 text-navy-900"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </>
          )}

          {/* Courses Container */}
          <div className="flex items-center justify-center gap-4 md:gap-6 lg:gap-8 px-12 md:px-16">
            {displayedCourses.map((course, index) => {
              // Middle course is always at index 1 if we have 3 courses
              // If we have fewer courses, center the first one
              const isMiddle = courses.length >= 3 ? index === 1 : courses.length === 1 ? index === 0 : index === Math.floor(courses.length / 2);
              const isEnrolled = enrolledCourseIds.has(course.id);
              const isEnrolling = enrollingCourseId === course.id;

              return (
                <div
                  key={`${course.id}-${safeCurrentIndex}-${index}`}
                  className={`transition-all duration-300 ${
                    isMiddle
                      ? 'flex-1 max-w-md scale-100 z-10'
                      : 'flex-1 max-w-xs scale-90 opacity-75 z-0'
                  }`}
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
    </section>
  );
}

