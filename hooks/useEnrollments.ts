import useSWR from 'swr';
import { supabase } from '@/lib/supabase';

async function fetchEnrollments(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('enrollments')
    .select('course_id')
    .eq('user_id', userId);

  if (error) throw error;
  return new Set(data?.map((e) => e.course_id) || []);
}

export function useEnrollments(userId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Set<string>>(
    userId ? ['enrollments', userId] : null,
    () => userId ? fetchEnrollments(userId) : Promise.resolve(new Set()),
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      fallbackData: new Set(),
    }
  );

  return {
    enrolledCourseIds: data || new Set(),
    isLoading,
    error,
    mutate,
  };
}










