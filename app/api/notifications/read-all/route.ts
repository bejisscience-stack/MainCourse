import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import { getTokenFromHeader } from "@/lib/admin-auth";
import { notificationLimiter, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// PATCH: Mark all notifications as read for the current user
export async function PATCH(request: NextRequest) {
  try {
    const token = getTokenFromHeader(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user, error: userError } = await verifyTokenAndGetUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { allowed, retryAfterMs } = await notificationLimiter.check(user.id);
    if (!allowed) {
      return rateLimitResponse(retryAfterMs);
    }

    const supabase = createServerSupabaseClient(token);

    console.log(
      "[Mark All Read API] Marking all notifications as read for user:",
      user.id,
    );

    // Direct UPDATE query instead of RPC for more reliable execution
    const {
      data,
      error: updateError,
      count,
    } = await supabase
      .from("notifications")
      .update({
        read: true,
        read_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("read", false)
      .select("id");

    if (updateError) {
      console.error(
        "[Mark All Read API] Error marking all as read:",
        updateError,
      );
      return NextResponse.json({ error: "An error occurred" }, { status: 500 });
    }

    const updatedCount = data?.length || 0;
    console.log(
      "[Mark All Read API] Successfully marked",
      updatedCount,
      "notifications as read",
    );

    return NextResponse.json({
      success: true,
      count: updatedCount,
    });
  } catch (error: any) {
    console.error("[Mark All Read API] Unhandled exception:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
