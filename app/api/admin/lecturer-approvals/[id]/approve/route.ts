import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { sendLecturerApprovedEmail } from "@/lib/email";
import { verifyAdminRequest, isAuthError } from "@/lib/admin-auth";
import { isValidUUID } from "@/lib/validation";
import { logAdminAction } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

// POST: Approve a lecturer account (admin only)
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

    console.log("[Lecturer Approve API] Approving lecturer:", id);

    // approve_lecturer_account internally checks auth.uid(), use user-scoped client
    const supabase = createServerSupabaseClient(token);
    const { error: approveError } = await supabase.rpc(
      "approve_lecturer_account",
      { p_user_id: id },
    );

    if (approveError) {
      console.error("[Lecturer Approve API] Error:", approveError);
      return NextResponse.json({ error: "An error occurred" }, { status: 500 });
    }

    // Fetch the lecturer profile for notification + email.
    // email/full_name are encrypted on profiles — use the decrypt RPC.
    const { data: decrypted, error: profileError } = await serviceSupabase.rpc(
      "get_decrypted_profile",
      { p_user_id: id },
    );
    const lecturerProfile = Array.isArray(decrypted) ? decrypted[0] : decrypted;

    if (profileError) {
      console.error(
        "[Lecturer Approve API] Error fetching profile:",
        profileError,
      );
    } else if (lecturerProfile) {
      // Create notification
      try {
        await serviceSupabase.rpc("create_notification", {
          p_user_id: lecturerProfile.id,
          p_type: "lecturer_approved",
          p_title_en: "Lecturer Account Approved",
          p_title_ge: "ლექტორის ანგარიში დამტკიცებულია",
          p_message_en:
            "Your lecturer account has been approved. You can now access your dashboard and create courses.",
          p_message_ge:
            "თქვენი ლექტორის ანგარიში დამტკიცებულია. ახლა შეგიძლიათ დეშბორდზე წვდომა და კურსების შექმნა.",
          p_metadata: { lecturer_id: id },
          p_created_by: userId,
        });
      } catch (notifError) {
        console.error("[Lecturer Approve API] Notification error:", notifError);
      }

      // Send email
      try {
        if (lecturerProfile.email) {
          await sendLecturerApprovedEmail(
            lecturerProfile.email,
            lecturerProfile.username || lecturerProfile.full_name,
          );
          console.log(
            "[Lecturer Approve API] Email sent to:",
            lecturerProfile.email,
          );
        }
      } catch (emailError) {
        console.error("[Lecturer Approve API] Email error:", emailError);
      }
    }

    // Audit log
    await logAdminAction(request, userId, "lecturer_approved", "profiles", id);

    return NextResponse.json({
      message: "Lecturer account approved successfully",
      success: true,
    });
  } catch (error: any) {
    console.error(
      "Error in POST /api/admin/lecturer-approvals/[id]/approve:",
      error,
    );
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
