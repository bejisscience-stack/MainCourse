import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import { getTokenFromHeader } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

async function checkAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("check_is_admin", {
    user_id: userId,
  });
  if (error) {
    console.error("[Free Projects API] check_is_admin error:", error);
    return false;
  }
  return data === true;
}

// GET: list approved lecturers + their free-project flag
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

    // Service-role client bypasses RLS for this admin read.
    const serviceSupabase = createServiceRoleClient(token);
    const { data, error } = await serviceSupabase
      .from("profiles")
      .select(
        "id, email, username, full_name, can_create_free_projects, lecturer_status, created_at, updated_at",
      )
      .eq("role", "lecturer")
      .eq("lecturer_status", "approved")
      .order("can_create_free_projects", { ascending: false })
      .order("full_name", { ascending: true });

    if (error) {
      console.error("[Free Projects API] select error:", error);
      return NextResponse.json({ error: "An error occurred" }, { status: 500 });
    }

    return NextResponse.json(
      { lecturers: data || [] },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    );
  } catch (err) {
    console.error("[Free Projects API] GET error:", err);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
