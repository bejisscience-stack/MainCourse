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
  try {
    let query = supabase
      .from('courses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (filter && filter !== 'All') {
      query = query.eq('course_type', filter);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[useCourses] Error fetching courses:', error);
      console.error('[useCourses] Error code:', error.code);
      console.error('[useCourses] Error message:', error.message);
      throw error;
    }
    
    console.log('[useCourses] Fetched courses:', data?.length || 0);
    return data || [];
  } catch (err: any) {
    console.error('[useCourses] Unexpected error:', err);
    throw err;
  }
}

export function useCourses(filter: string = 'All') {
  const { data, error, isLoading, mutate } = useSWR<Course[]>(
    ['courses', filter],
    () => fetchCourses(filter),
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000, // Dedupe requests within 10 seconds
      fallbackData: [],
      errorRetryCount: 3, // Only retry 3 times on error
      errorRetryInterval: 2000, // Wait 2 seconds between retries
      shouldRetryOnError: (error) => {
        // Don't retry on authentication errors or missing env vars
        if (error?.message?.includes('Missing Supabase') || 
            error?.code === 'PGRST301' || 
            error?.code === 'PGRST116') {
          return false;
        }
        return true;
      },
      onError: (error) => {
        console.error('[useCourses] SWR error:', error);
      },
    }
  );

  return {
    courses: data || [],
    isLoading,
    error,
    mutate,
  };
}










