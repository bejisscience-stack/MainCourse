'use client';

import { useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import CourseCard, { type Course } from '@/components/CourseCard';
import BackgroundShapes from '@/components/BackgroundShapes';
import { supabase } from '@/lib/supabase';

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'All' | 'Editing' | 'Content Creation' | 'Website Creation'>('All');

  useEffect(() => {
    fetchCourses();
  }, [filter]);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('courses')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter !== 'All') {
        query = query.eq('course_type', filter);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      setCourses(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load courses');
      console.error('Error fetching courses:', err);
    } finally {
      setLoading(false);
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
              <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg inline-block">
                <p className="font-semibold">Error loading courses</p>
                <p className="text-sm mt-1">{error}</p>
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {courses.map((course) => (
                    <CourseCard key={course.id} course={course} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

