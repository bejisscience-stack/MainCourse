import { NextRequest, NextResponse } from "next/server";
import {
  createServiceRoleClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import { getTokenFromHeader } from "@/lib/admin-auth";
import {
  referralLimiter,
  getClientIP,
  rateLimitResponse,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// POST: Validate referral code
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request);
    const { allowed, retryAfterMs } = await referralLimiter.check(ip);
    if (!allowed) return rateLimitResponse(retryAfterMs);

    const token = getTokenFromHeader(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user, error: userError } = await verifyTokenAndGetUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { referralCode } = body;

    if (!referralCode) {
      return NextResponse.json(
        { error: "referralCode is required" },
        { status: 400 },
      );
    }

    // Validate referralCode format
    if (
      typeof referralCode !== "string" ||
      referralCode.length > 20 ||
      !/^[A-Za-z0-9]{1,20}$/.test(referralCode)
    ) {
      return NextResponse.json(
        { valid: false, error: "Invalid referral code format" },
        { status: 200 },
      );
    }

    const supabase = createServiceRoleClient();

    // Normalize referral code (uppercase, trim)
    const normalizedCode = referralCode.trim().toUpperCase();

    // Check if this is the user's own referral code
    const { data: ownProfile } = await supabase
      .from("profiles")
      .select("referral_code")
      .eq("id", user.id)
      .single();

    if (ownProfile?.referral_code === normalizedCode) {
      return NextResponse.json({
        valid: false,
        error: "You cannot use your own referral code",
      });
    }

    // Check if referral code exists in profiles table
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("referral_code")
      .eq("referral_code", normalizedCode)
      .maybeSingle();

    if (error) {
      console.error("Error validating referral code:", error);
      return NextResponse.json(
        { error: "Failed to validate referral code" },
        { status: 500 },
      );
    }

    // Return validation result
    return NextResponse.json({
      valid: !!profile,
      message: profile ? "Valid referral code" : "Invalid referral code",
    });
  } catch (error: any) {
    console.error("Error in POST /api/validate-referral-code:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
