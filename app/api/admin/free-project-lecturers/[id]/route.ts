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

async function checkAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("check_is_admin", {
    user_id: userId,
  });
  if (error) {
    console.error("[Free Projects API] check_is_admin error:", error);
    return false;
  }
  return data === true;
}

// PATCH: toggle a lecturer's free-project exemption.
// Body: { allowed: boolean }
export async function PATCH(
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
    const isAdmin = await checkAdmin(supabase, user.id);
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 },
      );
    }

    const { id } = await params;
    if (!id || !isValidUUID(id)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    const { allowed: rateOk, retryAfterMs } = await adminLimiter.check(user.id);
    if (!rateOk) return rateLimitResponse(retryAfterMs);

    const body = await request.json().catch(() => null);
    if (
      !body ||
      typeof body !== "object" ||
      typeof (body as any).allowed !== "boolean"
    ) {
      return NextResponse.json(
        { error: "Invalid body: expected { allowed: boolean }" },
        { status: 400 },
      );
    }
    const allowed = (body as any).allowed as boolean;

    // Verify target is an approved lecturer.
    const serviceSupabase = createServiceRoleClient(token);
    const { data: target, error: lookupError } = await serviceSupabase
      .from("profiles")
      .select("id, role, lecturer_status, can_create_free_projects")
      .eq("id", id)
      .single();

    if (lookupError || !target) {
      return NextResponse.json(
        { error: "Lecturer not found" },
        { status: 404 },
      );
    }
    if (target.role !== "lecturer" || target.lecturer_status !== "approved") {
      return NextResponse.json(
        { error: "Target user is not an approved lecturer" },
        { status: 400 },
      );
    }

    if (target.can_create_free_projects === allowed) {
      // No-op — return current state without auditing a non-change.
      return NextResponse.json({
        success: true,
        unchanged: true,
        lecturer: target,
      });
    }

    const { data: updated, error: updateError } = await serviceSupabase
      .from("profiles")
      .update({
        can_create_free_projects: allowed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(
        "id, email, username, full_name, can_create_free_projects, lecturer_status, created_at, updated_at",
      )
      .single();

    if (updateError || !updated) {
      console.error("[Free Projects API] update error:", updateError);
      return NextResponse.json({ error: "An error occurred" }, { status: 500 });
    }

    await logAdminAction(
      request,
      user.id,
      allowed ? "grant_free_projects" : "revoke_free_projects",
      "profiles",
      id,
      { allowed },
    );

    return NextResponse.json({ success: true, lecturer: updated });
  } catch (err) {
    console.error("[Free Projects API] PATCH error:", err);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
