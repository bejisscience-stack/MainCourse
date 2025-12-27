import useSWR from 'swr';
import { supabase } from '@/lib/supabase';

export interface EnrollmentRequest {
  id: string;
  user_id: string;
  course_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  payment_screenshots?: string[] | null;
  courses?: {
    id: string;
    title: string;
    thumbnail_url?: string | null;
  } | null;
  profiles?: {
    id: string;
    username?: string | null;
    email: string;
  };
}

async function fetchEnrollmentRequests(userId: string): Promise<EnrollmentRequest[]> {
  const { data, error } = await supabase
    .from('enrollment_requests')
    .select(`
      id,
      user_id,
      course_id,
      status,
      created_at,
      updated_at,
      reviewed_by,
      reviewed_at,
      courses (
        id,
        title,
        thumbnail_url
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  // Transform the data to match the expected type
  // Supabase returns courses as an array, but we expect a single object
  return (data || []).map((item: any) => ({
    ...item,
    courses: Array.isArray(item.courses) && item.courses.length > 0 ? item.courses[0] : null,
  }));
}

async function fetchPendingRequestForCourse(userId: string, courseId: string): Promise<EnrollmentRequest | null> {
  const { data, error } = await supabase
    .from('enrollment_requests')
    .select(`
      id,
      user_id,
      course_id,
      status,
      created_at,
      updated_at,
      courses (
        id,
        title,
        thumbnail_url
      )
    `)
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .eq('status', 'pending')
    .maybeSingle();

  if (error) throw error;
  
  if (!data) return null;
  
  // Transform the data to match the expected type
  // Supabase returns courses as an array, but we expect a single object
  return {
    ...data,
    courses: Array.isArray(data.courses) && data.courses.length > 0 ? data.courses[0] : null,
  };
}

export function useEnrollmentRequests(userId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<EnrollmentRequest[]>(
    userId ? ['enrollment-requests', userId] : null,
    () => userId ? fetchEnrollmentRequests(userId) : Promise.resolve([]),
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      fallbackData: [],
    }
  );

  return {
    requests: data || [],
    isLoading,
    error,
    mutate,
  };
}

export function useEnrollmentRequestStatus(userId: string | null, courseId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<EnrollmentRequest | null>(
    userId && courseId ? ['enrollment-request-status', userId, courseId] : null,
    () => userId && courseId ? fetchPendingRequestForCourse(userId, courseId) : Promise.resolve(null),
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      fallbackData: null,
    }
  );

  return {
    request: data,
    isLoading,
    error,
    mutate,
    hasPendingRequest: !!data && data.status === 'pending',
  };
}

