import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import type { Course } from './useCourses';

async function fetchLecturerCourses(lecturerId: string): Promise<Course[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('lecturer_id', lecturerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export function useLecturerCourses(lecturerId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Course[]>(
    lecturerId ? ['lecturer-courses', lecturerId] : null,
    () => lecturerId ? fetchLecturerCourses(lecturerId) : Promise.resolve([]),
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
      fallbackData: [],
    }
  );

  return {
    courses: data || [],
    isLoading,
    error,
    mutate,
  };
}
