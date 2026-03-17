import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import { getTokenFromHeader } from "@/lib/admin-auth";
import { notificationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import type { Notification, NotificationsResponse } from "@/types/notification";

export const dynamic = "force-dynamic";

// GET: Fetch user's notifications with pagination
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const safePage = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const safeLimit = Math.max(
      1,
      Math.min(parseInt(searchParams.get("limit") || "20", 10), 100),
    );
    const unreadOnly = searchParams.get("unread") === "true";

    const page = safePage;
    const limit = safeLimit;
    const offset = (page - 1) * limit;

    console.log(
      "[Notifications API] Fetching notifications for user:",
      user.id,
      { page, limit, unreadOnly },
    );

    // Build query
    let query = supabase
      .from("notifications")
      .select(
        "id, user_id, type, title, message, read, read_at, metadata, created_at, updated_at, created_by",
        { count: "exact" },
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (unreadOnly) {
      query = query.eq("read", false);
    }

    const { data: notifications, error: fetchError, count } = await query;

    if (fetchError) {
      console.error(
        "[Notifications API] Error fetching notifications:",
        fetchError,
      );
      return NextResponse.json({ error: "An error occurred" }, { status: 500 });
    }

    const total = count || 0;
    const hasMore = offset + limit < total;

    const response: NotificationsResponse = {
      notifications: notifications as Notification[],
      total,
      page,
      limit,
      hasMore,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("[Notifications API] Unhandled exception:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
