import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import { getTokenFromHeader } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// Test endpoint to debug enrollment requests
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

    // Check admin status
    const { data: isAdmin } = await supabase.rpc("check_is_admin", {
      user_id: user.id,
    });
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Test 1: Direct query (may be limited by RLS)
    const { data: directData, error: directError } = await supabase
      .from("enrollment_requests")
      .select("id, user_id, course_id, status, created_at")
      .order("created_at", { ascending: false });

    // Test 2: Get counts
    const countResult = await supabase.rpc("get_enrollment_requests_count");
    const countData = countResult.data;
    const countError = countResult.error || null;

    // Test 3: RPC function with pending filter
    const { data: rpcPendingData, error: rpcPendingError } = await supabase.rpc(
      "get_enrollment_requests_admin",
      { filter_status: "pending" },
    );

    // Test 4: RPC function with null (all)
    const { data: rpcAllData, error: rpcAllError } = await supabase.rpc(
      "get_enrollment_requests_admin",
      { filter_status: null },
    );

    // Test 5: RPC function with empty string
    const { data: rpcEmptyData, error: rpcEmptyError } = await supabase.rpc(
      "get_enrollment_requests_admin",
      { filter_status: "" },
    );

    return NextResponse.json({
      counts: {
        data: countData,
        hasError: !!countError,
      },
      directQuery: {
        count: directData?.length || 0,
        data: directData?.map(
          (r: {
            id: string;
            course_id: string;
            status: string;
            created_at: string;
          }) => ({
            id: r.id,
            course_id: r.course_id,
            status: r.status,
            created_at: r.created_at,
          }),
        ),
        hasError: !!directError,
      },
      rpcPending: {
        count: rpcPendingData?.length || 0,
        data: rpcPendingData?.map(
          (r: { id: string; course_id: string; status: string }) => ({
            id: r.id,
            course_id: r.course_id,
            status: r.status,
          }),
        ),
        hasError: !!rpcPendingError,
      },
      rpcAll: {
        count: rpcAllData?.length || 0,
        data: rpcAllData?.map(
          (r: { id: string; course_id: string; status: string }) => ({
            id: r.id,
            course_id: r.course_id,
            status: r.status,
          }),
        ),
        hasError: !!rpcAllError,
      },
      rpcEmpty: {
        count: rpcEmptyData?.length || 0,
        data: rpcEmptyData?.map(
          (r: { id: string; course_id: string; status: string }) => ({
            id: r.id,
            course_id: r.course_id,
            status: r.status,
          }),
        ),
        hasError: !!rpcEmptyError,
      },
      userId: user.id,
    });
  } catch (error: any) {
    console.error("[Enrollment Test API] Error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
