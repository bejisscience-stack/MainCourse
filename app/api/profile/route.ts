import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import { getTokenFromHeader } from "@/lib/admin-auth";
import {
  accountLimiter,
  rateLimitResponse,
  getClientIP,
} from "@/lib/rate-limit";

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
      .select("id, username, avatar_url, project_access_expires_at, role")
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

    const rl = await accountLimiter.check(getClientIP(request));
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

    const body = await request.json();
    const { username, avatar_url } = body;

    // Build update object - only include fields that were sent
    const updateData: Record<string, any> = {};

    if (username !== undefined) {
      const trimmed = username.trim();
      if (
        !trimmed ||
        trimmed.length < 3 ||
        trimmed.length > 30 ||
        !/^[a-zA-Z0-9_]+$/.test(trimmed)
      ) {
        return NextResponse.json(
          {
            error:
              "Username must be 3-30 characters, only letters, numbers, and underscores",
          },
          { status: 400 },
        );
      }
      updateData.username = trimmed;
    }

    if (avatar_url !== undefined) {
      if (
        avatar_url !== null &&
        !/^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\//.test(avatar_url)
      ) {
        return NextResponse.json(
          { error: "Invalid avatar URL" },
          { status: 400 },
        );
      }
      updateData.avatar_url = avatar_url; // can be null to remove
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      );
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
