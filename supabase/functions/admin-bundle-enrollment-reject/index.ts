import {
  handleCors,
  getCorsHeaders,
  jsonResponse,
  errorResponse,
} from "../_shared/cors.ts";
import { getAuthenticatedUser, checkIsAdmin } from "../_shared/auth.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";
import { sendBundleEnrollmentRejectedEmail } from "../_shared/email.ts";

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  const cors = getCorsHeaders(req);

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, cors);
  }

  const auth = await getAuthenticatedUser(req);
  if ("response" in auth) return auth.response;
  const { user, supabase } = auth;

  const isAdmin = await checkIsAdmin(supabase, user.id);
  if (!isAdmin) {
    return errorResponse("Forbidden: Admin access required", 403, cors);
  }

  try {
    const body = await req.json();
    const { requestId, reason } = body;

    if (!requestId) {
      return errorResponse("requestId is required", 400, cors);
    }

    console.log("[Reject API] Attempting to reject bundle request:", requestId);

    const serviceSupabase = createServiceRoleClient();
    const { data: enrollmentRequest } = await serviceSupabase
      .from("bundle_enrollment_requests")
      .select("user_id, bundle_id, course_bundles(title)")
      .eq("id", requestId)
      .single();

    const { error: rejectError } = await supabase.rpc(
      "reject_bundle_enrollment_request",
      {
        request_id: requestId,
        admin_user_id: user.id,
      },
    );

    if (rejectError) {
      console.error("[Reject API] Error:", rejectError);
      return jsonResponse(
        {
          error: "Failed to reject bundle enrollment request",
          details: rejectError.message,
          code: rejectError.code,
        },
        500,
        cors,
      );
    }

    console.log("[Reject API] Rejection successful");

    if (enrollmentRequest?.user_id) {
      const bundleTitle =
        (enrollmentRequest.course_bundles as { title?: string } | null)
          ?.title || "Unknown Bundle";

      try {
        await serviceSupabase.rpc("create_notification", {
          p_user_id: enrollmentRequest.user_id,
          p_type: "bundle_enrollment_rejected",
          p_title_en: "Bundle Enrollment Request Update",
          p_title_ge: "პაკეტში რეგისტრაციის მოთხოვნის განახლება",
          p_message_en: `Your enrollment request for bundle "${bundleTitle}" was not approved.${reason ? ` Reason: ${reason}` : ""}`,
          p_message_ge: `თქვენი რეგისტრაციის მოთხოვნა პაკეტზე "${bundleTitle}" არ დამტკიცდა.${reason ? ` მიზეზი: ${reason}` : ""}`,
          p_metadata: {
            bundle_id: enrollmentRequest.bundle_id,
            bundle_title: bundleTitle,
            request_id: requestId,
            reason: reason || null,
          },
          p_created_by: user.id,
        });
        console.log("[Reject API] Notification created");
      } catch (notifError) {
        console.error("[Reject API] Notification error:", notifError);
      }

      try {
        const { data: profileData } = await serviceSupabase.rpc(
          "get_decrypted_profile",
          { p_user_id: enrollmentRequest.user_id },
        );

        const userEmail = profileData?.[0]?.email;
        if (userEmail) {
          await sendBundleEnrollmentRejectedEmail(
            userEmail,
            bundleTitle,
            reason,
          );
          console.log("[Reject API] Email sent to:", userEmail);
        }
      } catch (emailError) {
        console.error("[Reject API] Email error:", emailError);
      }
    }

    return jsonResponse(
      {
        message: "Bundle enrollment request rejected successfully",
        success: true,
      },
      200,
      cors,
    );
  } catch (error) {
    console.error("[Reject API] Error:", error);
    return errorResponse("Internal server error", 500, cors);
  }
});
