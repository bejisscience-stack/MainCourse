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

// POST: Reject a KYC submission with a required reason
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
    const reasonRaw =
      body.adminNotes ?? body.reason ?? body.rejectionReason ?? null;
    const reason =
      typeof reasonRaw === "string" ? reasonRaw.trim().substring(0, 500) : "";

    if (!reason) {
      return NextResponse.json(
        { error: "Rejection reason is required" },
        { status: 400 },
      );
    }

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

    const { error: rpcError } = await supabase.rpc("reject_kyc_submission", {
      p_submission_id: submissionId,
      p_admin_notes: reason,
    });

    if (rpcError) {
      console.error("[Reject KYC API] RPC error:", rpcError);
      return NextResponse.json({ error: "An error occurred" }, { status: 500 });
    }

    // Best-effort notification
    try {
      await serviceSupabase.rpc("create_notification", {
        p_user_id: submission.user_id,
        p_type: "kyc_rejected",
        p_title_en: "Identity Verification Rejected",
        p_title_ge: "იდენტიფიკაცია უარყოფილია",
        p_message_en: `Your identity verification was rejected. Reason: ${reason}`,
        p_message_ge: `თქვენი იდენტიფიკაცია უარყოფილია. მიზეზი: ${reason}`,
        p_metadata: { submission_id: submissionId, reason },
        p_created_by: user.id,
      });
    } catch (e) {
      console.error("[Reject KYC API] notification failed:", e);
    }

    await logAdminAction(
      request,
      user.id,
      "kyc_rejected",
      "kyc_submissions",
      submissionId,
    );

    return NextResponse.json({
      success: true,
      message: "KYC submission rejected successfully",
    });
  } catch (error: any) {
    console.error("[Reject KYC API] Unhandled exception:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
