import { NextRequest, NextResponse } from "next/server";
import {
  verifyAdminRequest,
  isAuthError,
  internalError,
} from "@/lib/admin-auth";
import { adminLimiter, rateLimitResponse, getClientIP } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Rate limit
    const ip = getClientIP(request);
    const { allowed, retryAfterMs } = await adminLimiter.check(
      `admin-emails:${ip}`,
    );
    if (!allowed) return rateLimitResponse(retryAfterMs);

    // Auth
    const authResult = await verifyAdminRequest(request);
    if (isAuthError(authResult)) return authResult;
    const { serviceSupabase } = authResult;

    // Fetch unified email list via service role (needed for decrypt_pii)
    const { data, error } = await serviceSupabase.rpc("get_admin_email_list");

    if (error) {
      console.error("[Admin Emails API] RPC error:", error);
      return NextResponse.json(
        { error: "Failed to fetch email list" },
        { status: 500 },
      );
    }

    return NextResponse.json({ emails: data || [] });
  } catch (err) {
    return internalError("Admin Emails API", err);
  }
}
