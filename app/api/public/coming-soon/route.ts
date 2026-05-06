import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-server";
import {
  subscribeLimiter,
  getClientIP,
  rateLimitResponse,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const { allowed, retryAfterMs } = await subscribeLimiter.check(
      getClientIP(request),
    );
    if (!allowed) return rateLimitResponse(retryAfterMs);

    const body = await request.json().catch(() => null);
    const raw = body && typeof body.email === "string" ? body.email : null;
    if (!raw) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const email = raw.trim().toLowerCase();
    if (
      email.length < 5 ||
      email.length > 254 ||
      /\s/.test(email) ||
      !EMAIL_RE.test(email)
    ) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("coming_soon_emails")
      .insert({ email });

    // 23505 = unique_violation → silent success (do not leak existence)
    if (error && error.code !== "23505") {
      console.error("coming-soon insert failed:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error in POST /api/public/coming-soon:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
