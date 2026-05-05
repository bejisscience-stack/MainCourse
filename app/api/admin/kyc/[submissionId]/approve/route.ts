import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import { getTokenFromHeader } from "@/lib/admin-auth";
import { isValidUUID } from "@/lib/validation";
import { adminLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAdminAction } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

async function checkAdmin(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("check_is_admin", {
      user_id: userId,
    });
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

// POST: Approve a KYC submission
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> },
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

    const serviceSupabase = createServiceRoleClient(token);
    const isAdmin = await checkAdmin(serviceSupabase, user.id);
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Access denied. Admin only." },
        { status: 403 },
      );
    }

    const supabase = createServerSupabaseClient(token);

    const { submissionId } = await params;
    if (!isValidUUID(submissionId)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    const { allowed, retryAfterMs } = await adminLimiter.check(user.id);
    if (!allowed) return rateLimitResponse(retryAfterMs);

    const body = await request.json().catch(() => ({}));
    const adminNotes = body.adminNotes?.substring(0, 500) || null;

    const { data: submission, error: fetchError } = await serviceSupabase
      .from("kyc_submissions")
      .select("id, user_id, status")
      .eq("id", submissionId)
      .single();

    if (fetchError || !submission) {
      return NextResponse.json(
        { error: "KYC submission not found" },
        { status: 404 },
      );
    }

    if (submission.status !== "pending") {
      return NextResponse.json(
        { error: `Submission is already ${submission.status}` },
        { status: 400 },
      );
    }

    const { error: rpcError } = await supabase.rpc("approve_kyc_submission", {
      p_submission_id: submissionId,
      p_admin_notes: adminNotes,
    });

    if (rpcError) {
      console.error("[Approve KYC API] RPC error:", rpcError);
      return NextResponse.json({ error: "An error occurred" }, { status: 500 });
    }

    // Best-effort notification
    try {
      await serviceSupabase.rpc("create_notification", {
        p_user_id: submission.user_id,
        p_type: "kyc_approved",
        p_title_en: "Identity Verified",
        p_title_ge: "იდენტიფიკაცია დადასტურებულია",
        p_message_en:
          "Your identity has been verified. You can now request withdrawals.",
        p_message_ge:
          "თქვენი იდენტიფიკაცია დადასტურებულია. ახლა შეგიძლიათ თანხის გატანის მოთხოვნა.",
        p_metadata: { submission_id: submissionId },
        p_created_by: user.id,
      });
    } catch (e) {
      console.error("[Approve KYC API] notification failed:", e);
    }

    await logAdminAction(
      request,
      user.id,
      "kyc_approved",
      "kyc_submissions",
      submissionId,
    );

    return NextResponse.json({
      success: true,
      message: "KYC submission approved successfully",
    });
  } catch (error: any) {
    console.error("[Approve KYC API] Unhandled exception:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
