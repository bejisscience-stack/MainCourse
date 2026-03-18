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
  const { data, error } = await supabase.rpc("check_is_admin", {
    user_id: userId,
  });

  if (error) {
    console.error("Error checking admin status:", error);
    return false;
  }

  return data === true;
}

// GET: Fetch all lecturer accounts for admin review
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
        { error: "Forbidden: Admin access required" },
        { status: 403 },
      );
    }

    // Get query params for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // 'pending', 'approved', 'rejected', or null for all

    // Use RPC function to get all lecturers (bypasses RLS, marked VOLATILE)
    const serviceSupabase = createServiceRoleClient(token);
    const { data: lecturers, error: rpcError } = await serviceSupabase.rpc(
      "get_pending_lecturers",
    );

    if (rpcError) {
      console.error("[Lecturer Approvals API] RPC error:", rpcError);
      return NextResponse.json({ error: "An error occurred" }, { status: 500 });
    }

    const filtered = filterByStatus(lecturers || [], status);

    try {
      await logAdminAction(
        request,
        user.id,
        "view_lecturer_approvals",
        "profiles",
        "list",
        { count: filtered.length },
      );
    } catch (e) {
      console.error("[Audit] Log failed:", e);
    }

    return respondWithLecturers(filtered);
  } catch (error: any) {
    console.error("Error in GET /api/admin/lecturer-approvals:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}

function filterByStatus(lecturers: any[], status: string | null) {
  if (!status || status === "all") return lecturers;
  if (status === "pending")
    return lecturers.filter((l) => l.is_approved === false);
  if (status === "approved")
    return lecturers.filter((l) => l.is_approved === true);
  if (status === "rejected")
    return lecturers.filter((l) => l.is_approved === false);
  return lecturers;
}

function respondWithLecturers(lecturers: any[]) {
  return NextResponse.json(
    { lecturers },
    {
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    },
  );
}
