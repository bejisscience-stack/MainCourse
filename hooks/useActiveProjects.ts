import { useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import { useRealtimeProjects, useRealtimeProjectCriteria } from './useRealtimeProjects';

export interface ProjectCriteria {
  id: string;
  criteria_text: string;
  rpm: number;
  display_order: number;
  platform: string | null;
}

export interface ActiveProject {
  id: string;
  message_id: string;
  channel_id: string;
  course_id: string;
  user_id: string;
  name: string;
  description: string;
  video_link: string | null;
  budget: number;
  min_views: number;
  max_views: number;
  platforms: string[];
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
  // Joined data
  course_title: string;
  course_thumbnail_url: string | null;
  lecturer_id: string;
  lecturer_username: string | null;
  lecturer_full_name: string | null;
  // Criteria
  criteria: ProjectCriteria[];
}

async function fetchActiveProjects(): Promise<ActiveProject[]> {
  try {
    // Get current date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    // Fetch active projects with course and lecturer info
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select(`
        *,
        courses!inner (
          id,
          title,
          thumbnail_url,
          lecturer_id
        )
      `)
      .not('start_date', 'is', null)
      .not('end_date', 'is', null)
      .lte('start_date', today)
      .gte('end_date', today)
      .order('budget', { ascending: false });

    if (projectsError) {
      console.error('[useActiveProjects] Error fetching projects:', projectsError);
      throw projectsError;
    }

    if (!projects || projects.length === 0) {
      return [];
    }

    // Get unique lecturer IDs
    const lecturerIds = [...new Set(projects.map((p: any) => p.courses.lecturer_id))];

    // Fetch lecturer profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, full_name')
      .in('id', lecturerIds);

    if (profilesError) {
      console.error('[useActiveProjects] Error fetching profiles:', profilesError);
      // Continue without profiles - not critical
    }

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // Get all project IDs to fetch criteria
    const projectIds = projects.map((p: any) => p.id);

    // Fetch criteria for all projects
    const { data: allCriteria, error: criteriaError } = await supabase
      .from('project_criteria')
      .select('*')
      .in('project_id', projectIds)
      .order('display_order', { ascending: true });

    if (criteriaError) {
      console.error('[useActiveProjects] Error fetching criteria:', criteriaError);
      // Continue without criteria - not critical
    }

    // Group criteria by project_id
    const criteriaMap = new Map<string, ProjectCriteria[]>();
    allCriteria?.forEach((c: any) => {
      if (!criteriaMap.has(c.project_id)) {
        criteriaMap.set(c.project_id, []);
      }
      criteriaMap.get(c.project_id)!.push({
        id: c.id,
        criteria_text: c.criteria_text,
        rpm: c.rpm,
        display_order: c.display_order,
        platform: c.platform,
      });
    });

    // Map projects to ActiveProject interface
    const activeProjects: ActiveProject[] = projects.map((p: any) => {
      const lecturerProfile = profileMap.get(p.courses.lecturer_id);
      return {
        id: p.id,
        message_id: p.message_id,
        channel_id: p.channel_id,
        course_id: p.course_id,
        user_id: p.user_id,
        name: p.name,
        description: p.description,
        video_link: p.video_link,
        budget: parseFloat(p.budget),
        min_views: p.min_views,
        max_views: p.max_views,
        platforms: p.platforms,
        start_date: p.start_date,
        end_date: p.end_date,
        created_at: p.created_at,
        updated_at: p.updated_at,
        course_title: p.courses.title,
        course_thumbnail_url: p.courses.thumbnail_url,
        lecturer_id: p.courses.lecturer_id,
        lecturer_username: lecturerProfile?.username || null,
        lecturer_full_name: lecturerProfile?.full_name || null,
        criteria: criteriaMap.get(p.id) || [],
      };
    });

    console.log('[useActiveProjects] Fetched active projects:', activeProjects.length);
    return activeProjects;
  } catch (err: any) {
    console.error('[useActiveProjects] Unexpected error:', err);
    throw err;
  }
}

export function useActiveProjects() {
  const { data, error, isLoading, mutate } = useSWR<ActiveProject[]>(
    'active-projects',
    fetchActiveProjects,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // Dedupe requests within 30 seconds
      fallbackData: [],
      errorRetryCount: 3,
      errorRetryInterval: 2000,
      shouldRetryOnError: (error) => {
        // Don't retry on authentication errors
        if (error?.message?.includes('Missing Supabase') ||
            error?.code === 'PGRST301' ||
            error?.code === 'PGRST116') {
          return false;
        }
        return true;
      },
      onError: (error) => {
        console.error('[useActiveProjects] SWR error:', error);
      },
    }
  );

  // Callback to refresh projects data
  const refreshProjects = useCallback(() => {
    console.log('[useActiveProjects] Real-time update triggered, refreshing data');
    mutate();
  }, [mutate]);

  // Set up real-time subscription for projects table
  const { isConnected: projectsRtConnected } = useRealtimeProjects({
    enabled: true,
    onInsert: refreshProjects,
    onUpdate: refreshProjects,
    onDelete: refreshProjects,
  });

  // Also listen for project criteria changes
  const { isConnected: criteriaRtConnected } = useRealtimeProjectCriteria({
    enabled: true,
    onChange: refreshProjects,
  });

  return {
    projects: data || [],
    isLoading,
    error,
    mutate,
    isRealtimeConnected: projectsRtConnected && criteriaRtConnected,
  };
}
