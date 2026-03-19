import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
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

    // Use RPC function to get all lecturers (SECURITY DEFINER bypasses RLS, VOLATILE prevents caching)
    // Must use user-scoped client so auth.uid() works inside the RPC's admin check
    const { data: lecturers, error: rpcError } = await supabase.rpc(
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
    return lecturers.filter((l) => l.lecturer_status === "pending");
  if (status === "approved")
    return lecturers.filter((l) => l.lecturer_status === "approved");
  if (status === "rejected")
    return lecturers.filter((l) => l.lecturer_status === "rejected");
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
