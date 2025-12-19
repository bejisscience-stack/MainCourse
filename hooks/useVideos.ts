import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import type { Video, VideoProgress } from '@/types/server';

async function fetchVideos(channelId: string, courseId: string, userId: string): Promise<Video[]> {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('channel_id', channelId)
    .eq('course_id', courseId)
    .order('display_order', { ascending: true });

  if (error) throw error;

  // Load progress for each video
  const videoIds = (data || []).map((v) => v.id);
  const { data: progressData } = await supabase
    .from('video_progress')
    .select('*')
    .eq('user_id', userId)
    .in('video_id', videoIds);

  const progressMap = new Map(
    (progressData || []).map((p) => [p.video_id, p as VideoProgress])
  );

  return (data || []).map((v) => ({
    id: v.id,
    channelId: v.channel_id,
    courseId: v.course_id,
    title: v.title,
    description: v.description || undefined,
    videoUrl: v.video_url,
    thumbnailUrl: v.thumbnail_url || undefined,
    duration: v.duration || undefined,
    displayOrder: v.display_order,
    isPublished: v.is_published,
    progress: progressMap.get(v.id)
      ? (() => {
          const p = progressMap.get(v.id)! as any;
          return {
            id: p.id,
            userId: p.user_id || p.userId,
            videoId: p.video_id || p.videoId,
            courseId: p.course_id || p.courseId,
            progressSeconds: p.progress_seconds || p.progressSeconds,
            durationSeconds: p.duration_seconds || p.durationSeconds || undefined,
            isCompleted: p.is_completed || p.isCompleted,
            completedAt: p.completed_at || p.completedAt || undefined,
          };
        })()
      : undefined,
  }));
}

export function useVideos(channelId: string | null, courseId: string | null, userId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Video[]>(
    channelId && courseId && userId ? ['videos', channelId, courseId, userId] : null,
    () => fetchVideos(channelId!, courseId!, userId!),
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
      fallbackData: [],
    }
  );

  return {
    videos: data || [],
    isLoading,
    error,
    mutate,
  };
}







