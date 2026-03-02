import { createServerSupabaseClient, verifyTokenAndGetUser, createServiceRoleClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/view-scraper/submissions
 * Fetch submissions with video URLs, joined with project/course/profile data
 * Supports ?project_id= filter
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const { user, error: userError } = await verifyTokenAndGetUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerSupabaseClient(token);
    const { data: isAdmin, error: adminError } = await supabase.rpc('check_is_admin', { user_id: user.id });
    if (adminError || !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const serviceClient = createServiceRoleClient(token);
    const projectId = request.nextUrl.searchParams.get('project_id');

    let query = serviceClient
      .from('project_submissions')
      .select(`
        id,
        user_id,
        project_id,
        video_url,
        platform_links,
        latest_views,
        last_scraped_at,
        created_at,
        status,
        profiles!project_submissions_user_id_fkey (
          username,
          avatar_url
        ),
        projects!project_submissions_project_id_fkey (
          title,
          course_id,
          min_views,
          max_views,
          platforms,
          courses!projects_course_id_fkey (
            title
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data: submissions, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter to only submissions that have video URLs
    const withVideos = (submissions || [])
      .filter((s: any) => {
        const hasVideoUrl = s.video_url && s.video_url.trim();
        const hasPlatformLinks = s.platform_links && Object.keys(s.platform_links).length > 0;
        return hasVideoUrl || hasPlatformLinks;
      })
      .map((s: any) => ({
        id: s.id,
        user_id: s.user_id,
        project_id: s.project_id,
        video_url: s.video_url,
        platform_links: s.platform_links,
        latest_views: s.latest_views || {},
        last_scraped_at: s.last_scraped_at,
        created_at: s.created_at,
        status: s.status,
        username: s.profiles?.username || 'Unknown',
        avatar_url: s.profiles?.avatar_url || null,
        project_title: s.projects?.title || 'Unknown Project',
        course_title: s.projects?.courses?.title || 'Unknown Course',
        course_id: s.projects?.course_id || '',
        min_views: s.projects?.min_views || null,
        max_views: s.projects?.max_views || null,
        platforms: s.projects?.platforms || null,
      }));

    return NextResponse.json({ submissions: withVideos });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
