import {
  createServerSupabaseClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import { getTokenFromHeader } from "@/lib/admin-auth";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/view-scraper/check
 * Check a single submission's video views
 * Body: { submission_id: string }
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

    const body = await request.json();
    if (!body.submission_id) {
      return NextResponse.json(
        { error: "submission_id required" },
        { status: 400 },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    const response = await fetch(`${supabaseUrl}/functions/v1/view-scraper`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ submission_id: body.submission_id }),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    console.error("[View Scraper Check API] Unhandled exception:", err);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
