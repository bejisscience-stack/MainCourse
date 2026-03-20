import { NextRequest, NextResponse } from "next/server";
import {
  createServiceRoleClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import { getTokenFromHeader } from "@/lib/admin-auth";
import { completeProfileSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromHeader(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user, error: userError } = await verifyTokenAndGetUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await request.json();
    const parsed = completeProfileSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request data" },
        { status: 400 },
      );
    }
    const { username, role } = parsed.data;

    const supabase = createServiceRoleClient(token);

    // Verify profile is actually incomplete (prevent abuse)
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("profile_completed")
      .eq("id", user.id)
      .single();

    if (currentProfile?.profile_completed !== false) {
      return NextResponse.json(
        { error: "Profile is already complete" },
        { status: 400 },
      );
    }

    // Update profile — always role='student', lecturer application via lecturer_status
    const updatePayload: Record<string, unknown> = {
      username,
      role: "student",
      profile_completed: true,
    };
    if (role === "lecturer") {
      updatePayload.is_approved = false;
      updatePayload.lecturer_status = "pending";
    }

    const { data: updated, error: updateError } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("id", user.id)
      .select("username, role, profile_completed")
      .single();

    if (updateError) {
      console.error("Error completing profile:", updateError);
      if (
        updateError.message?.includes("duplicate") ||
        updateError.message?.includes("unique") ||
        updateError.code === "23505"
      ) {
        return NextResponse.json({ error: "username_taken" }, { status: 409 });
      }
      return NextResponse.json(
        { error: "Failed to complete profile" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      username: updated?.username,
      role: updated?.role,
    });
  } catch (error: any) {
    console.error("Error in POST /api/complete-profile:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
