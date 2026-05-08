import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { sendLecturerRejectedEmail } from "@/lib/email";
import { verifyAdminRequest, isAuthError } from "@/lib/admin-auth";
import { isValidUUID } from "@/lib/validation";
import { logAdminAction } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

// POST: Reject a lecturer account (admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await verifyAdminRequest(request);
    if (isAuthError(auth)) return auth;
    const { token, userId, serviceSupabase } = auth;

    const { id } = await params;

    if (!id || !isValidUUID(id)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    let reason: string | undefined;
    try {
      const body = await request.json();
      reason = body.reason?.substring(0, 500);
    } catch {
      // No body is fine — reason is optional
    }

    const { data: lecturerProfile } = await serviceSupabase
      .from("profiles")
      .select("id, email, username, full_name")
      .eq("id", id)
      .single();

    console.log("[Lecturer Reject API] Rejecting lecturer:", id);

    // reject_lecturer_account internally checks auth.uid(), use user-scoped client
    const supabase = createServerSupabaseClient(token);
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
          p_created_by: userId,
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
    await logAdminAction(request, userId, "lecturer_rejected", "profiles", id, {
      reason,
    });

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
