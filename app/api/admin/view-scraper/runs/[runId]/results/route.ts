import {
  createServerSupabaseClient,
  verifyTokenAndGetUser,
  createServiceRoleClient,
} from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { getTokenFromHeader } from "@/lib/admin-auth";
import { isValidUUID } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/view-scraper/runs/[runId]/results
 * Fetch scrape results for a specific run, enriched with username and course title
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
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

    const { runId } = await params;

    if (!isValidUUID(runId)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    const serviceClient = createServiceRoleClient(token);

    const { data: results, error } = await serviceClient
      .from("view_scrape_results")
      .select(
        `
        id,
        submission_id,
        project_id,
        user_id,
        scrape_run_id,
        platform,
        video_url,
        view_count,
        like_count,
        comment_count,
        share_count,
        save_count,
        error_message,
        scraped_at,
        projects!view_scrape_results_project_id_fkey (
          name,
          course_id,
          courses!projects_course_id_fkey (
            title
          )
        )
      `,
      )
      .eq("scrape_run_id", runId)
      .order("scraped_at", { ascending: false });

    if (error) {
      console.error("[View Scraper Run Results API] Error:", error);
      return NextResponse.json({ error: "An error occurred" }, { status: 500 });
    }

    // Fetch profiles separately for usernames
    const userIds = [
      ...new Set((results || []).map((r: any) => r.user_id).filter(Boolean)),
    ];
    let profileMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await serviceClient
        .from("profiles")
        .select("id, username")
        .in("id", userIds);
      for (const p of profiles || []) {
        profileMap.set(p.id, p.username || "Unknown");
      }
    }

    const enrichedResults = (results || []).map((r: any) => ({
      id: r.id,
      submission_id: r.submission_id,
      project_id: r.project_id,
      user_id: r.user_id,
      scrape_run_id: r.scrape_run_id,
      platform: r.platform,
      video_url: r.video_url,
      view_count: r.view_count,
      like_count: r.like_count,
      comment_count: r.comment_count,
      share_count: r.share_count,
      save_count: r.save_count,
      error_message: r.error_message,
      scraped_at: r.scraped_at,
      username: profileMap.get(r.user_id) || "Unknown",
      course_title: r.projects?.courses?.title || "Unknown Course",
    }));

    return NextResponse.json({ results: enrichedResults });
  } catch (err) {
    console.error("[View Scraper Run Results API] Unhandled exception:", err);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
