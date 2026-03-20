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

// Helper function to check if user is admin using RPC function (bypasses RLS)
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

// POST: Reject a bundle enrollment request (admin only)
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

    // Check if user is admin
    const isAdmin = await checkAdmin(supabase, user.id);
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 },
      );
    }

    // Await params (Next.js 15 requirement)
    const { id } = await params;

    if (!id || !isValidUUID(id)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    // Rate limit
    const { allowed, retryAfterMs } = await adminLimiter.check(user.id);
    if (!allowed) return rateLimitResponse(retryAfterMs);

    // Fetch the bundle enrollment request details before rejecting
    const serviceSupabase = createServiceRoleClient(token);
    const { data: bundleRequest } = await serviceSupabase
      .from("bundle_enrollment_requests")
      .select("user_id, bundle_id, course_bundles(title)")
      .eq("id", id)
      .single();

    console.log("[Bundle Reject API] Attempting to reject request:", id);

    // Use the RPC function to reject the bundle enrollment
    // Pass the admin_user_id parameter so it works with service role
    const { error: rejectError } = await supabase.rpc(
      "reject_bundle_enrollment_request",
      {
        request_id: id,
        admin_user_id: user.id,
      },
    );

    if (rejectError) {
      console.error(
        "[Bundle Reject API] Error rejecting bundle enrollment request:",
        {
          code: rejectError.code,
          message: rejectError.message,
          details: rejectError.details,
          hint: rejectError.hint,
        },
      );
      return NextResponse.json({ error: "An error occurred" }, { status: 500 });
    }

    console.log("[Bundle Reject API] Rejection successful");

    // Create notification for the user
    if (bundleRequest?.user_id) {
      const bundleTitle =
        (bundleRequest.course_bundles as { title?: string } | null)?.title ||
        "Unknown Bundle";

      try {
        await serviceSupabase.rpc("create_notification", {
          p_user_id: bundleRequest.user_id,
          p_type: "bundle_enrollment_rejected",
          p_title_en: "Bundle Enrollment Update",
          p_title_ge: "პაკეტის რეგისტრაციის განახლება",
          p_message_en: `Your enrollment request for the bundle "${bundleTitle}" was not approved.`,
          p_message_ge: `თქვენი რეგისტრაციის მოთხოვნა პაკეტზე "${bundleTitle}" არ დამტკიცდა.`,
          p_metadata: {
            bundle_id: bundleRequest.bundle_id,
            bundle_title: bundleTitle,
            request_id: id,
          },
          p_created_by: user.id,
        });
      } catch (notifError) {
        console.error(
          "[Bundle Reject API] Error creating notification:",
          notifError,
        );
      }
    }

    // Audit log
    await logAdminAction(
      request,
      user.id,
      "bundle_enrollment_rejected",
      "bundle_enrollment_requests",
      id,
    );

    // Return success - the frontend will refresh the list
    return NextResponse.json({
      message: "Bundle enrollment request rejected successfully",
      success: true,
    });
  } catch (error: any) {
    console.error(
      "Error in POST /api/admin/bundle-enrollment-requests/[id]/reject:",
      error,
    );
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
