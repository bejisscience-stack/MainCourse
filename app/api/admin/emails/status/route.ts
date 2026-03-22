import { NextRequest, NextResponse } from "next/server";
import {
  verifyAdminRequest,
  isAuthError,
  internalError,
} from "@/lib/admin-auth";
import { adminLimiter, rateLimitResponse, getClientIP } from "@/lib/rate-limit";
import { getResend } from "@/lib/resend";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIP(request);
    const { allowed, retryAfterMs } = await adminLimiter.check(
      `admin-email-status:${ip}`,
    );
    if (!allowed) return rateLimitResponse(retryAfterMs);

    const authResult = await verifyAdminRequest(request);
    if (isAuthError(authResult)) return authResult;
    const { serviceSupabase } = authResult;

    const email = request.nextUrl.searchParams.get("email");
    if (!email) {
      return NextResponse.json(
        { error: "email query parameter is required" },
        { status: 400 },
      );
    }

    // Fetch send history for this email, newest first
    const { data: history, error: historyError } = await serviceSupabase
      .from("email_send_history")
      .select(
        "id, recipient_email, subject, sent_at, resend_message_id, metadata",
      )
      .eq("recipient_email", email.toLowerCase())
      .order("sent_at", { ascending: false })
      .limit(20);

    if (historyError) {
      console.error("[Admin Email Status] History fetch error:", historyError);
      return NextResponse.json(
        { error: "Failed to fetch email history" },
        { status: 500 },
      );
    }

    if (!history || history.length === 0) {
      return NextResponse.json({ history: [] });
    }

    // For entries with resend_message_id, fetch delivery status from Resend
    const resend = getResend();
    const enriched = await Promise.all(
      history.map(async (entry) => {
        if (!entry.resend_message_id) {
          return { ...entry, resend_status: null };
        }
        try {
          const { data } = await resend.emails.get(entry.resend_message_id);
          return {
            ...entry,
            resend_status: data?.last_event || null,
          };
        } catch {
          return { ...entry, resend_status: null };
        }
      }),
    );

    return NextResponse.json({ history: enriched });
  } catch (err) {
    return internalError("Admin Email Status API", err);
  }
}
