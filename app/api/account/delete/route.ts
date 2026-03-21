import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import { getTokenFromHeader } from "@/lib/admin-auth";
import {
  accountLimiter,
  rateLimitResponse,
  getClientIP,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest) {
  try {
    // 1. Verify auth token
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

    // 2. Fetch profile to check role
    const supabase = createServerSupabaseClient(token);
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("[DeleteAccount] Profile fetch error:", profileError);
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // 3. Block lecturers and admins
    if (profile.role === "lecturer" || profile.role === "admin") {
      return NextResponse.json(
        { error: "role_cannot_delete" },
        { status: 403 },
      );
    }

    // 4. Use service role to clean up non-cascading rows and delete auth user
    const serviceSupabase = createServiceRoleClient();

    // Delete rows from tables that lack ON DELETE CASCADE
    // Order matters: payment_audit_log references keepz_payments(id), so delete it first
    const { error: auditDeleteError } = await serviceSupabase
      .from("payment_audit_log")
      .delete()
      .eq("user_id", user.id);

    if (auditDeleteError) {
      console.error(
        "[DeleteAccount] Audit log cleanup error:",
        auditDeleteError,
      );
      return NextResponse.json(
        { error: "Failed to delete account" },
        { status: 500 },
      );
    }

    const { error: paymentsDeleteError } = await serviceSupabase
      .from("keepz_payments")
      .delete()
      .eq("user_id", user.id);

    if (paymentsDeleteError) {
      console.error(
        "[DeleteAccount] Payments cleanup error:",
        paymentsDeleteError,
      );
      return NextResponse.json(
        { error: "Failed to delete account" },
        { status: 500 },
      );
    }

    // 5. Delete auth user — this cascades to profiles and all other FK tables
    const { error: deleteError } = await serviceSupabase.auth.admin.deleteUser(
      user.id,
    );

    if (deleteError) {
      console.error("[DeleteAccount] Auth deletion error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete account" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[DeleteAccount] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
