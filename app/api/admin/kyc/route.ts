import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import { getTokenFromHeader } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

async function checkAdmin(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("check_is_admin", {
      user_id: userId,
    });
    if (error) {
      console.error("[Admin KYC API] check_is_admin error:", error);
      return false;
    }
    return data === true;
  } catch (err) {
    console.error("[Admin KYC API] check_is_admin exception:", err);
    return false;
  }
}

// GET: Fetch all KYC submissions with optional status filter (admin only)
export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromHeader(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user, error: userError } = await verifyTokenAndGetUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServerSupabaseClient(token);
    const isAdmin = await checkAdmin(supabase, user.id);
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Access denied. Admin only." },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");

    const ALLOWED_STATUSES = ["pending", "verified", "rejected", "all"];
    if (statusFilter && !ALLOWED_STATUSES.includes(statusFilter)) {
      return NextResponse.json(
        { error: "Invalid status filter" },
        { status: 400 },
      );
    }

    const filterStatus =
      statusFilter && statusFilter !== "all" && statusFilter.trim() !== ""
        ? statusFilter
        : null;

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "get_kyc_submissions_admin",
      { filter_status: filterStatus },
    );

    if (rpcError) {
      console.error("[Admin KYC API] RPC error:", rpcError);
      return NextResponse.json(
        { error: "Failed to fetch submissions" },
        { status: 500 },
      );
    }

    const submissions = rpcData || [];

    // Enrich with profile info via service-role helper (mirrors admin-withdrawals)
    const userIds = [
      ...new Set(submissions.map((s: any) => s.user_id).filter(Boolean)),
    ];

    let profilesMap = new Map<string, any>();
    if (userIds.length > 0) {
      try {
        const { data: profilesData, error: profilesError } =
          await createServiceRoleClient(token).rpc("get_decrypted_profiles", {
            p_user_ids: userIds,
          });
        if (!profilesError && profilesData) {
          profilesMap = new Map(profilesData.map((p: any) => [p.id, p]));
        } else if (profilesError) {
          console.error(
            "[Admin KYC API] decrypted profiles error:",
            profilesError,
          );
        }
      } catch (err) {
        console.error("[Admin KYC API] profile join failed:", err);
      }
    }

    const submissionsWithRelations = submissions.map((s: any) => ({
      ...s,
      profiles: profilesMap.get(s.user_id) ?? null,
    }));

    try {
      await logAdminAction(
        request,
        user.id,
        "view_kyc_submissions",
        "kyc_submissions",
        "list",
        { count: submissionsWithRelations.length },
      );
    } catch (e) {
      console.error("[Admin KYC API] Audit log failed:", e);
    }

    return NextResponse.json(
      { submissions: submissionsWithRelations },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    );
  } catch (error: any) {
    console.error("[Admin KYC API] Unhandled exception:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
