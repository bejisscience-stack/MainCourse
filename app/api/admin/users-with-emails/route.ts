import { NextRequest, NextResponse } from "next/server";
import {
  verifyAdminRequest,
  isAuthError,
  internalError,
} from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

// GET /api/admin/users-with-emails
//
// Admin-only. Returns { users: [{ id, username, email }] } for the entire
// profiles table. Backs the AdminNotificationSender "specific users" picker,
// which previously called get_safe_profiles (now stripped of email per
// final_security_guide A-3 / mig 239).
//
// Email decryption goes through get_decrypted_profiles, which is granted to
// service_role only (mig 174). verifyAdminRequest enforces admin role +
// per-user adminLimiter. Each call is audit-logged.
export async function GET(request: NextRequest) {
  const auth = await verifyAdminRequest(request);
  if (isAuthError(auth)) return auth;

  const { userId, serviceSupabase } = auth;

  try {
    const { data: idRows, error: idError } = await serviceSupabase
      .from("profiles")
      .select("id");

    if (idError) {
      return internalError("admin/users-with-emails:list-ids", idError);
    }

    const allIds = (idRows || []).map((p) => p.id);
    if (allIds.length === 0) {
      return NextResponse.json({ users: [] });
    }

    const { data: profiles, error: rpcError } = await serviceSupabase.rpc(
      "get_decrypted_profiles",
      { p_user_ids: allIds },
    );

    if (rpcError) {
      return internalError("admin/users-with-emails:rpc", rpcError);
    }

    const users = (profiles || [])
      .map(
        (p: { id: string; username: string | null; email: string | null }) => ({
          id: p.id,
          username: p.username,
          email: p.email ?? "",
        }),
      )
      .filter((u: { email: string }) => u.email);

    await logAdminAction(
      request,
      userId,
      "list_users_with_emails",
      "profiles",
      "*",
      { count: users.length },
    );

    return NextResponse.json({ users });
  } catch (err) {
    return internalError("admin/users-with-emails", err);
  }
}
