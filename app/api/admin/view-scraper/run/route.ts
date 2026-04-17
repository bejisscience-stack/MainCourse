import {
  createServerSupabaseClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import { getTokenFromHeader } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit-log";
import { scraperRunSchema } from "@/lib/schemas";
import { adminLimiter, rateLimitResponse, getClientIP } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/view-scraper/run
 * Trigger a full scrape run (optionally filtered by project_id)
 * Proxies to the view-scraper Edge Function
 */
export async function POST(request: NextRequest) {
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

    const rl = await adminLimiter.check(getClientIP(request));
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

    const rawBody = await request.json().catch(() => ({}));
    const parsed = scraperRunSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }
    const body = parsed.data;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    const response = await fetch(`${supabaseUrl}/functions/v1/view-scraper`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ project_id: body.project_id || null }),
    });

    const data = await response.json();

    try {
      await logAdminAction(
        request,
        user.id,
        "run_scraper",
        "view_scrape_runs",
        body.project_id || "all",
        {
          project_id: body.project_id || null,
          response_status: response.status,
        },
      );
    } catch (e) {
      console.error("[Audit] Failed to log:", e);
    }

    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    console.error("[View Scraper Run API] Unhandled exception:", err);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
