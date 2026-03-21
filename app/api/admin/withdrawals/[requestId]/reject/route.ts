import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import { sendWithdrawalRejectedEmail } from "@/lib/email";
import { getTokenFromHeader } from "@/lib/admin-auth";
import { isValidUUID } from "@/lib/validation";
import { adminLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAdminAction } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

// Helper function to check if user is admin using RPC function (bypasses RLS)
async function checkAdmin(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("check_is_admin", {
      user_id: userId,
    });

    if (error) {
      console.error(
        "[Reject Withdrawal API] Error checking admin status:",
        error,
      );
      return false;
    }

    return data === true;
  } catch (err) {
    console.error("[Reject Withdrawal API] Exception checking admin:", err);
    return false;
  }
}

// POST: Reject a withdrawal request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
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

    // Pass user token as fallback so RLS admin policies work if service role key is missing
    const serviceSupabase = createServiceRoleClient(token);

    // Check if user is admin
    const isAdmin = await checkAdmin(serviceSupabase, user.id);
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Access denied. Admin only." },
        { status: 403 },
      );
    }

    // Create authenticated client for RPC calls that rely on auth.uid()
    const supabase = createServerSupabaseClient(token);

    // Await params (Next.js 15 requirement)
    const { requestId } = await params;
    if (!isValidUUID(requestId)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    // Rate limit
    const { allowed, retryAfterMs } = await adminLimiter.check(user.id);
    if (!allowed) return rateLimitResponse(retryAfterMs);

    const body = await request.json().catch(() => ({}));
    const adminNotes = body.adminNotes?.substring(0, 500) || null;
    const reason = body.reason?.substring(0, 500) || null;

    // Fetch the withdrawal request
    const { data: withdrawalRequest, error: fetchError } = await serviceSupabase
      .from("withdrawal_requests")
      .select("id, user_id, amount, status, bank_account_number, created_at")
      .eq("id", requestId)
      .single();

    if (fetchError || !withdrawalRequest) {
      console.error("[Reject Withdrawal API] Request not found:", fetchError);
      return NextResponse.json(
        { error: "Withdrawal request not found" },
        { status: 404 },
      );
    }

    if (withdrawalRequest.status !== "pending") {
      return NextResponse.json(
        { error: `Request is already ${withdrawalRequest.status}` },
        { status: 400 },
      );
    }

    // Use authenticated client (not service role) so auth.uid() works in the database function
    const { error: rejectError } = await supabase.rpc(
      "reject_withdrawal_request",
      {
        p_request_id: requestId,
        p_admin_notes: adminNotes || reason || null,
      },
    );

    if (rejectError) {
      console.error("[Reject Withdrawal API] RPC error:", rejectError);
      return NextResponse.json({ error: "An error occurred" }, { status: 500 });
    }

    // Create notification for the user
    try {
      const rejectionMessage = reason
        ? `Your withdrawal request for ₾${withdrawalRequest.amount.toFixed(2)} has been rejected. Reason: ${reason}`
        : `Your withdrawal request for ₾${withdrawalRequest.amount.toFixed(2)} has been rejected.`;
      const rejectionMessageGe = reason
        ? `თქვენი თანხის გატანის მოთხოვნა ₾${withdrawalRequest.amount.toFixed(2)}-ზე უარყოფილია. მიზეზი: ${reason}`
        : `თქვენი თანხის გატანის მოთხოვნა ₾${withdrawalRequest.amount.toFixed(2)}-ზე უარყოფილია.`;

      const { error: notificationError } = await serviceSupabase.rpc(
        "create_notification",
        {
          p_user_id: withdrawalRequest.user_id,
          p_type: "withdrawal_rejected",
          p_title_en: "Withdrawal Rejected",
          p_title_ge: "თანხის გატანა უარყოფილია",
          p_message_en: rejectionMessage,
          p_message_ge: rejectionMessageGe,
          p_metadata: {
            request_id: requestId,
            amount: withdrawalRequest.amount,
            reason: reason || undefined,
          },
          p_created_by: user.id,
        },
      );

      if (notificationError) {
        console.error(
          "[Reject Withdrawal API] Error creating notification:",
          notificationError,
        );
      }
    } catch (notifError) {
      console.error(
        "[Reject Withdrawal API] Exception creating notification:",
        notifError,
      );
    }

    // Send email notification
    try {
      const { data: userProfile } = await serviceSupabase.rpc(
        "get_decrypted_profile",
        { p_user_id: withdrawalRequest.user_id },
      );

      const decryptedEmail = userProfile?.[0]?.email ?? userProfile?.email;
      if (decryptedEmail) {
        await sendWithdrawalRejectedEmail(
          decryptedEmail,
          withdrawalRequest.amount,
          reason || undefined,
        );
      }
    } catch (emailError) {
      console.error("[Reject Withdrawal API] Error sending email:", emailError);
    }

    // Audit log
    await logAdminAction(
      request,
      user.id,
      "withdrawal_rejected",
      "withdrawal_requests",
      requestId,
    );

    return NextResponse.json({
      success: true,
      message: "Withdrawal request rejected successfully",
    });
  } catch (error: any) {
    console.error("[Reject Withdrawal API] Unhandled exception:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
