import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { verifyAdminRequest, isAuthError } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

// GET: Fetch all lecturer accounts for admin review
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminRequest(request);
    if (isAuthError(auth)) return auth;
    const { token, userId } = auth;

    // get_pending_lecturers internally checks auth.uid(), so use a user-scoped client
    const supabase = createServerSupabaseClient(token);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // 'pending' | 'approved' | 'rejected' | null

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
        userId,
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
