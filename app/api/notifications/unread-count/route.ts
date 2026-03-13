import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import { getTokenFromHeader } from "@/lib/admin-auth";
import { notificationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import type { UnreadCountResponse } from "@/types/notification";

export const dynamic = "force-dynamic";

// GET: Get unread notification count for the current user
export async function GET(request: NextRequest) {
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

    // Direct count query instead of RPC for more reliable execution
    const { count, error: countError } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("read", false);

    if (countError) {
      console.error(
        "[Unread Count API] Error getting unread count:",
        countError,
      );
      return NextResponse.json({ error: "An error occurred" }, { status: 500 });
    }

    const response: UnreadCountResponse = {
      count: count || 0,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("[Unread Count API] Unhandled exception:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
