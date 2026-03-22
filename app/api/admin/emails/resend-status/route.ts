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
      `admin-resend-status:${ip}`,
    );
    if (!allowed) return rateLimitResponse(retryAfterMs);

    const authResult = await verifyAdminRequest(request);
    if (isAuthError(authResult)) return authResult;

    const resend = getResend();
    const statusMap: Record<
      string,
      { status: string; subject: string; date: string }
    > = {};

    // Paginate through recent emails (up to 500)
    let cursor: string | undefined;
    let pages = 0;
    const maxPages = 5;

    while (pages < maxPages) {
      const opts: { limit: number; after?: string } = { limit: 100 };
      if (cursor) opts.after = cursor;

      const { data, error } = await resend.emails.list(opts);

      if (error || !data) {
        console.error("[Admin Resend Status] API error:", error);
        break;
      }

      for (const email of data.data) {
        const recipients = Array.isArray(email.to) ? email.to : [email.to];
        for (const recipient of recipients) {
          const key = recipient.toLowerCase();
          // Keep only the most recent entry per recipient
          if (
            !statusMap[key] ||
            new Date(email.created_at) > new Date(statusMap[key].date)
          ) {
            statusMap[key] = {
              status: email.last_event,
              subject: email.subject,
              date: email.created_at,
            };
          }
        }
      }

      if (!data.has_more || data.data.length === 0) break;

      // Use the last item's id as cursor
      cursor = data.data[data.data.length - 1].id;
      pages++;
    }

    return NextResponse.json({ statuses: statusMap });
  } catch (err) {
    return internalError("Admin Resend Status API", err);
  }
}
