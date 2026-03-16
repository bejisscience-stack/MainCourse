import {
  createServerSupabaseClient,
  verifyTokenAndGetUser,
  createServiceRoleClient,
} from "@/lib/supabase-server";
import { getTokenFromHeader } from "@/lib/admin-auth";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/view-scraper/submissions
 * Fetch submissions with video URLs, joined with project/course/profile data
 * Supports ?project_id= filter
 */
export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromHeader(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user, error: userError } = await verifyTokenAndGetUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServerSupabaseClient(token);
    const { data: isAdmin, error: adminError } = await supabase.rpc(
      "check_is_admin",
      { user_id: user.id },
    );
    if (adminError || !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const serviceClient = createServiceRoleClient(token);
    const projectId = request.nextUrl.searchParams.get("project_id");

    // Query submissions with project join only (no profiles FK exists)
    let query = serviceClient
      .from("project_submissions")
      .select(
        `
        id,
        user_id,
        project_id,
        video_url,
        platform_links,
        latest_views,
        last_scraped_at,
        created_at,
        status,
        projects!project_submissions_project_id_fkey (
          name,
          course_id,
          min_views,
          max_views,
          platforms,
          courses!projects_course_id_fkey (
            title
          )
        )
      `,
      )
      .order("created_at", { ascending: false });

    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    const { data: submissions, error } = await query;

    if (error) {
      console.error("[View Scraper Submissions API] Error:", error);
      return NextResponse.json({ error: "An error occurred" }, { status: 500 });
    }

    // Fetch profiles separately (no FK relationship on this table)
    const userIds = [
      ...new Set(
        (submissions || []).map((s: any) => s.user_id).filter(Boolean),
      ),
    ];
    let profileMap = new Map<
      string,
      { username: string; avatar_url: string | null }
    >();
    if (userIds.length > 0) {
      const { data: profiles } = await serviceClient
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", userIds);
      for (const p of profiles || []) {
        profileMap.set(p.id, {
          username: p.username,
          avatar_url: p.avatar_url,
        });
      }
    }

    // Fetch accepted reviews for these submissions
    const submissionIds = (submissions || []).map((s: any) => s.id);
    const reviewMap = new Map<string, any[]>();

    if (submissionIds.length > 0) {
      const { data: reviews } = await serviceClient
        .from("submission_reviews")
        .select(
          "id, submission_id, platform, status, payment_amount, payout_amount, paid_at, paid_by",
        )
        .in("submission_id", submissionIds)
        .eq("status", "accepted");

      for (const r of reviews || []) {
        const existing = reviewMap.get(r.submission_id) || [];
        existing.push(r);
        reviewMap.set(r.submission_id, existing);
      }
    }

    // Filter to submissions with video URLs AND at least one accepted review
    const withVideos = (submissions || [])
      .filter((s: any) => {
        const hasVideoUrl = s.video_url && s.video_url.trim();
        const hasPlatformLinks =
          s.platform_links && Object.keys(s.platform_links).length > 0;
        const hasAcceptedReview = reviewMap.has(s.id);
        return (hasVideoUrl || hasPlatformLinks) && hasAcceptedReview;
      })
      .map((s: any) => {
        const profile = profileMap.get(s.user_id);
        return {
          id: s.id,
          user_id: s.user_id,
          project_id: s.project_id,
          video_url: s.video_url,
          platform_links: s.platform_links,
          latest_views: s.latest_views || {},
          last_scraped_at: s.last_scraped_at,
          created_at: s.created_at,
          status: s.status,
          username: profile?.username || "Unknown",
          avatar_url: profile?.avatar_url || null,
          project_title: s.projects?.name || "Unknown Project",
          course_title: s.projects?.courses?.title || "Unknown Course",
          course_id: s.projects?.course_id || "",
          min_views: s.projects?.min_views || null,
          max_views: s.projects?.max_views || null,
          platforms: s.projects?.platforms || null,
          reviews: reviewMap.get(s.id) || [],
        };
      });

    return NextResponse.json({ submissions: withVideos });
  } catch (err) {
    console.error("[View Scraper Submissions API] Unhandled exception:", err);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
