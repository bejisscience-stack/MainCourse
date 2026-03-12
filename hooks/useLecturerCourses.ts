import useSWR from "swr";
import { supabase } from "@/lib/supabase";
import type { Course } from "./useCourses";

async function fetchLecturerCourses(lecturerId: string): Promise<Course[]> {
  const { data, error } = await supabase
    .from("courses")
    .select(
      "id, title, description, course_type, price, original_price, author, creator, intro_video_url, thumbnail_url, rating, review_count, is_bestseller, referral_commission_percentage, created_at, updated_at, lecturer_id",
    )
    .eq("lecturer_id", lecturerId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export function useLecturerCourses(lecturerId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Course[]>(
    lecturerId ? ["lecturer-courses", lecturerId] : null,
    () => (lecturerId ? fetchLecturerCourses(lecturerId) : Promise.resolve([])),
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
      fallbackData: [],
    },
  );

  return {
    courses: Array.isArray(data) ? data : [],
    isLoading,
    error,
    mutate,
  };
}
