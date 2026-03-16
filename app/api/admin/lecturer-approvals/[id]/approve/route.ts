import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import { sendLecturerApprovedEmail } from "@/lib/email";
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

// POST: Approve a lecturer account (admin only)
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

    console.log("[Lecturer Approve API] Approving lecturer:", id);

    // Call RPC to approve (uses auth.uid() for admin check)
    const { error: approveError } = await supabase.rpc(
      "approve_lecturer_account",
      { p_user_id: id },
    );

    if (approveError) {
      console.error("[Lecturer Approve API] Error:", approveError);
      return NextResponse.json({ error: "An error occurred" }, { status: 500 });
    }

    // Fetch the lecturer profile for notification + email
    const serviceSupabase = createServiceRoleClient(token);
    const { data: lecturerProfile, error: profileError } = await serviceSupabase
      .from("profiles")
      .select("id, email, username, full_name")
      .eq("id", id)
      .single();

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
          p_created_by: user.id,
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
    logAdminAction(request, user.id, "lecturer_approved", "profiles", id);

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
