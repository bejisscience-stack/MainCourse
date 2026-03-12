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
 * GET /api/admin/view-scraper/history/[submissionId]
 * Fetch scrape history for a specific submission
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { submissionId: string } },
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

    const serviceClient = createServiceRoleClient(token);
    const { submissionId } = params;

    if (!isValidUUID(submissionId)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    const { data: history, error } = await serviceClient
      .from("view_scrape_results")
      .select(
        "id, submission_id, run_id, platform, view_count, scraped_at, raw_data",
      )
      .eq("submission_id", submissionId)
      .order("scraped_at", { ascending: false });

    if (error) {
      console.error("[View Scraper History API] Error:", error);
      return NextResponse.json({ error: "An error occurred" }, { status: 500 });
    }

    return NextResponse.json({ history: history || [] });
  } catch (err) {
    console.error("[View Scraper History API] Unhandled exception:", err);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
