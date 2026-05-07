import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import { getTokenFromHeader } from "@/lib/admin-auth";
import { completeProfileSchema } from "@/lib/schemas";
import {
  accountLimiter,
  rateLimitResponse,
  getClientIP,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
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

    const rawBody = await request.json();
    const parsed = completeProfileSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request data" },
        { status: 400 },
      );
    }
    const { username, role, marketingEmailsConsent } = parsed.data;

    // User-scoped client; the SECURITY DEFINER RPC `complete_own_profile`
    // whitelists the writable columns (username, profile_completed,
    // terms_accepted*, marketing_emails_consent*, lecturer_status, is_approved).
    // No service-role surface on this route.
    const supabase = createServerSupabaseClient(token);

    const { data, error: rpcError } = await supabase
      .rpc("complete_own_profile", {
        p_username: username,
        p_role: role,
        p_marketing_emails_consent: marketingEmailsConsent,
      })
      .single<{
        username: string;
        role: string;
        profile_completed: boolean;
      }>();

    if (rpcError) {
      const msg = rpcError.message || "";
      if (rpcError.code === "23505" || /duplicate|unique/i.test(msg)) {
        return NextResponse.json({ error: "username_taken" }, { status: 409 });
      }
      if (
        rpcError.code === "22023" ||
        /Profile already complete|Invalid role|Invalid username/i.test(msg)
      ) {
        return NextResponse.json(
          { error: "Invalid request data" },
          { status: 400 },
        );
      }
      if (rpcError.code === "42501" || /Not authenticated/i.test(msg)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      console.error("Error completing profile:", rpcError);
      return NextResponse.json(
        { error: "Failed to complete profile" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      username: data?.username,
      role: data?.role,
    });
  } catch (error: any) {
    console.error("Error in POST /api/complete-profile:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
