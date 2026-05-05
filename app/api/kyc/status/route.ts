import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import { getTokenFromHeader } from "@/lib/admin-auth";
import {
  generalLimiter,
  rateLimitResponse,
  getClientIP,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET: Fetch the current user's KYC status + most recent submission
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

    const rl = await generalLimiter.check(getClientIP(request));
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

    const supabase = createServerSupabaseClient(token);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("kyc_status")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("[KYC Status API] profile fetch error:", profileError);
      return NextResponse.json(
        { error: "Failed to load profile" },
        { status: 500 },
      );
    }

    const { data: submissions, error: submissionError } = await supabase
      .from("kyc_submissions")
      .select(
        "id, user_id, doc_type, doc_front_path, doc_back_path, selfie_path, phone, status, admin_notes, reviewed_by, reviewed_at, created_at, updated_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (submissionError) {
      console.error(
        "[KYC Status API] submission fetch error:",
        submissionError,
      );
    }

    return NextResponse.json({
      status: profile.kyc_status ?? "not_submitted",
      submission: submissions?.[0] ?? null,
    });
  } catch (error: any) {
    console.error("[KYC Status API] Unhandled exception:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
