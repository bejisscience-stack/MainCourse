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

    const body = await request
      .json()
      .catch(() => ({}) as Record<string, unknown>);
    const password = (body as { password?: unknown }).password;
    if (
      typeof password !== "string" ||
      password.length < 1 ||
      password.length > 200
    ) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

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

    if (profile.role === "lecturer" || profile.role === "admin") {
      return NextResponse.json(
        { error: "role_cannot_delete" },
        { status: 403 },
      );
    }

    if (!user.email) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }
    const reauthClient = createServerSupabaseClient(token);
    const { error: reauthError } = await reauthClient.auth.signInWithPassword({
      email: user.email,
      password,
    });
    if (reauthError) {
      return NextResponse.json({ error: "invalid_password" }, { status: 401 });
    }

    const serviceSupabase = createServiceRoleClient();

    // Anonymize financial rows (preserve audit trail) instead of deleting.
    // payment_audit_log references keepz_payments(id); update order does not
    // matter for SET user_id = NULL since we are not touching that FK.
    const { error: auditAnonError } = await serviceSupabase
      .from("payment_audit_log")
      .update({ user_id: null })
      .eq("user_id", user.id);

    if (auditAnonError) {
      console.error(
        "[DeleteAccount] Audit log anonymize error:",
        auditAnonError,
      );
      return NextResponse.json(
        { error: "Failed to delete account" },
        { status: 500 },
      );
    }

    const { error: paymentsAnonError } = await serviceSupabase
      .from("keepz_payments")
      .update({ user_id: null })
      .eq("user_id", user.id);

    if (paymentsAnonError) {
      console.error(
        "[DeleteAccount] Payments anonymize error:",
        paymentsAnonError,
      );
      return NextResponse.json(
        { error: "Failed to delete account" },
        { status: 500 },
      );
    }

    // Self-action audit tombstone. Direct service-role INSERT because
    // insert_audit_log RPC blocks non-admin callers (migrations 153, 177).
    // Best-effort: failure here does not abort the deletion.
    const { error: auditInsertError } = await serviceSupabase
      .from("audit_log")
      .insert({
        admin_user_id: user.id,
        action: "self_account_deleted",
        target_table: "auth.users",
        target_id: user.id,
        metadata: { initiated_at: new Date().toISOString() },
        ip_address: getClientIP(request),
      });

    if (auditInsertError) {
      console.error(
        "[DeleteAccount] Audit tombstone insert error:",
        auditInsertError,
      );
    }

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
