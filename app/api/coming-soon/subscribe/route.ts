import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-server";
import {
  subscribeLimiter,
  getClientIP,
  rateLimitResponse,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request);
    const { allowed, retryAfterMs } = await subscribeLimiter.check(ip);
    if (!allowed) return rateLimitResponse(retryAfterMs);

    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 },
      );
    }

    const supabase = createServiceRoleClient();

    const { error } = await supabase
      .from("coming_soon_emails")
      .insert({ email: email.toLowerCase().trim() });

    if (error) {
      // Handle duplicate email
      if (error.code === "23505") {
        return NextResponse.json(
          { message: "Email already subscribed" },
          { status: 200 },
        );
      }

      console.error("[Coming Soon Subscribe] Error:", error);
      return NextResponse.json(
        { error: "Failed to subscribe" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { message: "Successfully subscribed" },
      { status: 201 },
    );
  } catch (err) {
    console.error("[Coming Soon Subscribe] Exception:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
