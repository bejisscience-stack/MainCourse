import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getClientIP } from "@/lib/rate-limit";

/**
 * Log an admin action to the audit_log table.
 * Best-effort: failures are logged but never throw.
 *
 * Uses the caller's JWT so auth.uid() is set in the RPC,
 * preventing admin ID spoofing (RLS-12).
 */
export async function logAdminAction(
  request: NextRequest,
  adminUserId: string,
  action: string,
  targetTable: string,
  targetId: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      console.error(
        "[AuditLog] No Authorization header — cannot log action:",
        action,
      );
      return;
    }

    const supabase = createServerSupabaseClient(token);
    const ip = getClientIP(request);

    await supabase.rpc("insert_audit_log", {
      p_admin_user_id: adminUserId,
      p_action: action,
      p_target_table: targetTable,
      p_target_id: targetId,
      p_metadata: metadata || {},
      p_ip_address: ip,
    });
  } catch (err) {
    console.error("[AuditLog] Failed to log action:", action, err);
  }
}
