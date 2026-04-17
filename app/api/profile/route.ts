import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import { getTokenFromHeader } from "@/lib/admin-auth";
import { writeLimiter, rateLimitResponse, getClientIP } from "@/lib/rate-limit";
import { profileUpdateSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

// GET: Fetch own profile (including project_access_expires_at)
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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        "id, username, avatar_url, project_access_expires_at, role, created_at",
      )
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
      return NextResponse.json(
        { error: "Failed to fetch profile" },
        { status: 500 },
      );
    }

    return NextResponse.json({ profile });
  } catch (error: any) {
    console.error("Error in GET /api/profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// PATCH: Update username and/or avatar_url
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

    const rl = await writeLimiter.check(getClientIP(request));
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

    const rawBody = await request.json().catch(() => ({}));
    const parsed = profileUpdateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const updateData: Record<string, any> = {};
    if (parsed.data.username !== undefined) {
      updateData.username = parsed.data.username;
    }
    if (parsed.data.avatar_url !== undefined) {
      updateData.avatar_url = parsed.data.avatar_url; // nullable
    }

    const supabase = createServerSupabaseClient(token);

    const { data: updated, error: updateError } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", user.id)
      .select("username, avatar_url")
      .single();

    if (updateError) {
      console.error("Error updating profile:", updateError);
      if (
        updateError.message?.includes("duplicate") ||
        updateError.message?.includes("unique") ||
        updateError.code === "23505"
      ) {
        return NextResponse.json({ error: "username_taken" }, { status: 409 });
      }
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      username: updated?.username,
      avatar_url: updated?.avatar_url,
    });
  } catch (error: any) {
    console.error("Error in PATCH /api/profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
