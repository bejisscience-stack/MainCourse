import useSWR from 'swr';
import { supabase } from '@/lib/supabase';

export interface Course {
  id: string;
  title: string;
  description: string | null;
  course_type: 'Editing' | 'Content Creation' | 'Website Creation';
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
  lecturer_id?: string;
}

async function fetchCourses(filter?: string): Promise<Course[]> {
  let query = supabase
    .from('courses')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (filter && filter !== 'All') {
    query = query.eq('course_type', filter);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export function useCourses(filter: string = 'All') {
  const { data, error, isLoading, mutate } = useSWR<Course[]>(
    ['courses', filter],
    () => fetchCourses(filter),
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000, // Dedupe requests within 10 seconds
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







