import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import { sendLecturerRejectedEmail } from "@/lib/email";
import { getTokenFromHeader } from "@/lib/admin-auth";
import { isValidUUID } from "@/lib/validation";
import { adminLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAdminAction } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

async function checkAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("check_is_admin", {
    user_id: userId,
  });

  if (error) {
    console.error("Error checking admin status:", error);
    return false;
  }

  return data === true;
}

// POST: Reject a lecturer account (admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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

    const isAdmin = await checkAdmin(supabase, user.id);
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 },
      );
    }

    const { id } = await params;

    if (!id || !isValidUUID(id)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    // Rate limit
    const { allowed, retryAfterMs } = await adminLimiter.check(user.id);
    if (!allowed) return rateLimitResponse(retryAfterMs);

    // Parse reason from body
    let reason: string | undefined;
    try {
      const body = await request.json();
      reason = body.reason?.substring(0, 500);
    } catch {
      // No body is fine — reason is optional
    }

    // Fetch lecturer profile before rejecting (for email)
    const serviceSupabase = createServiceRoleClient(token);
    const { data: lecturerProfile } = await serviceSupabase
      .from("profiles")
      .select("id, email, username, full_name")
      .eq("id", id)
      .single();

    console.log("[Lecturer Reject API] Rejecting lecturer:", id);

    // Call RPC to reject
    const { error: rejectError } = await supabase.rpc(
      "reject_lecturer_account",
      { p_user_id: id, p_reason: reason || null },
    );

    if (rejectError) {
      console.error("[Lecturer Reject API] Error:", rejectError);
      return NextResponse.json({ error: "An error occurred" }, { status: 500 });
    }

    // Send notification and email
    if (lecturerProfile) {
      // Create notification
      try {
        await serviceSupabase.rpc("create_notification", {
          p_user_id: lecturerProfile.id,
          p_type: "lecturer_rejected",
          p_title_en: "Lecturer Account Update",
          p_title_ge: "ლექტორის ანგარიშის განახლება",
          p_message_en: `Your lecturer account request was not approved.${reason ? ` Reason: ${reason}` : ""}`,
          p_message_ge: `თქვენი ლექტორის ანგარიშის მოთხოვნა არ დამტკიცდა.${reason ? ` მიზეზი: ${reason}` : ""}`,
          p_metadata: { lecturer_id: id, reason },
          p_created_by: user.id,
        });
      } catch (notifError) {
        console.error("[Lecturer Reject API] Notification error:", notifError);
      }

      // Send email
      try {
        if (lecturerProfile.email) {
          await sendLecturerRejectedEmail(
            lecturerProfile.email,
            lecturerProfile.username || lecturerProfile.full_name,
            reason,
          );
          console.log(
            "[Lecturer Reject API] Email sent to:",
            lecturerProfile.email,
          );
        }
      } catch (emailError) {
        console.error("[Lecturer Reject API] Email error:", emailError);
      }
    }

    // Audit log
    await logAdminAction(
      request,
      user.id,
      "lecturer_rejected",
      "profiles",
      id,
      {
        reason,
      },
    );

    return NextResponse.json({
      message: "Lecturer account rejected successfully",
      success: true,
    });
  } catch (error: any) {
    console.error(
      "Error in POST /api/admin/lecturer-approvals/[id]/reject:",
      error,
    );
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
