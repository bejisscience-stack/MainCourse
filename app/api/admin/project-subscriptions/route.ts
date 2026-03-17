import {
  createServerSupabaseClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import { getTokenFromHeader } from "@/lib/admin-auth";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/admin/project-subscriptions
 * Fetch all project subscriptions (admin only)
 * Returns subscriptions joined with profile info (username, avatar_url)
 */
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

    // Fetch subscriptions (no profile join — FK goes to auth.users, not profiles)
    const { data: subs, error: subsError } = await supabase
      .from("project_subscriptions")
      .select(
        "id, user_id, price, status, created_at, payment_screenshot, approved_at",
      )
      .order("created_at", { ascending: false });

    if (subsError) {
      console.error("Subscription fetch error:", subsError);
      return NextResponse.json(
        { error: "Failed to fetch subscriptions" },
        { status: 500 },
      );
    }

    // Fetch profiles for all user_ids
    const userIds = [...new Set((subs || []).map((s: any) => s.user_id))];
    let profileMap: Record<
      string,
      { username: string; avatar_url: string | null }
    > = {};

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", userIds);

      if (profiles) {
        for (const p of profiles) {
          profileMap[p.id] = {
            username: p.username || "Unknown",
            avatar_url: p.avatar_url,
          };
        }
      }
    }

    // Merge
    const subscriptions = (subs || []).map((sub: any) => ({
      id: sub.id,
      user_id: sub.user_id,
      username: profileMap[sub.user_id]?.username || "Unknown",
      avatar_url: profileMap[sub.user_id]?.avatar_url || null,
      price: sub.price,
      status: sub.status,
      created_at: sub.created_at,
      payment_screenshot: sub.payment_screenshot,
      approved_at: sub.approved_at,
    }));

    // Count by status
    const counts = {
      pending: subscriptions.filter((s: any) => s.status === "pending").length,
      active: subscriptions.filter((s: any) => s.status === "active").length,
      rejected: subscriptions.filter((s: any) => s.status === "rejected")
        .length,
    };

    return NextResponse.json({ subscriptions, counts });
  } catch (err) {
    console.error("[Project Subscriptions API] Unhandled exception:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
