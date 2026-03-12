import {
  createServerSupabaseClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { getTokenFromHeader } from "@/lib/admin-auth";
import { isValidUUID } from "@/lib/validation";
import { adminLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAdminAction } from "@/lib/audit-log";

/**
 * POST /api/admin/project-subscriptions/[id]/approve
 * Approve a project subscription request (admin only)
 * Calls approve_project_subscription RPC
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: subscriptionId } = await params;

    const token = getTokenFromHeader(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user, error: userError } = await verifyTokenAndGetUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isValidUUID(subscriptionId)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    // Rate limit
    const { allowed, retryAfterMs } = adminLimiter.check(user.id);
    if (!allowed) return rateLimitResponse(retryAfterMs);

    const supabase = createServerSupabaseClient(token);

    // Check admin status
    const { data: isAdmin, error: adminError } = await supabase.rpc(
      "check_is_admin",
      {
        user_id: user.id,
      },
    );

    if (adminError || !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Call RPC to approve
    const { data, error } = await supabase.rpc("approve_project_subscription", {
      subscription_id: subscriptionId,
    });

    if (error) {
      console.error("[Project Sub Approve API] RPC error:", error.message);
      return NextResponse.json({ error: "An error occurred" }, { status: 500 });
    }

    // Audit log
    logAdminAction(
      request,
      user.id,
      "project_subscription_approved",
      "project_subscriptions",
      subscriptionId,
    );

    return NextResponse.json(data);
  } catch (err) {
    console.error("[Project Sub Approve API] Unhandled exception:", err);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
