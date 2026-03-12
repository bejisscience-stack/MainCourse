import {
  createServerSupabaseClient,
  verifyTokenAndGetUser,
  createServiceRoleClient,
} from "@/lib/supabase-server";
import { getTokenFromHeader } from "@/lib/admin-auth";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/view-scraper/runs
 * Fetch all scrape runs with triggerer username
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

    const { data: runs, error } = await serviceClient
      .from("view_scrape_runs")
      .select(
        `
        id,
        triggered_by,
        trigger_type,
        status,
        total_urls,
        successful,
        failed,
        started_at,
        completed_at,
        error_log
      `,
      )
      .order("started_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[View Scraper Runs API] Error:", error);
      return NextResponse.json({ error: "An error occurred" }, { status: 500 });
    }

    // Fetch usernames for triggered_by
    const userIds = [
      ...new Set(
        (runs || []).filter((r) => r.triggered_by).map((r) => r.triggered_by),
      ),
    ];
    let profileMap: Record<string, string> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await serviceClient
        .from("profiles")
        .select("id, username")
        .in("id", userIds);

      profileMap = (profiles || []).reduce((acc: Record<string, string>, p) => {
        acc[p.id] = p.username || "Unknown";
        return acc;
      }, {});
    }

    const enrichedRuns = (runs || []).map((run) => ({
      ...run,
      triggered_by_username: run.triggered_by
        ? profileMap[run.triggered_by] || null
        : null,
    }));

    return NextResponse.json({ runs: enrichedRuns });
  } catch (err) {
    console.error("[View Scraper Runs API] Unhandled exception:", err);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
