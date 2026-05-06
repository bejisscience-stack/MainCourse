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
    console.error("[Student Project Access API] check_is_admin error:", error);
    return false;
  }
  return data === true;
}

// Escape characters that have special meaning inside a PostgREST .or() filter.
// `,` separates clauses, `*` is the wildcard inside ilike patterns,
// and `%`/`_` are SQL LIKE wildcards.
function escapeForOrFilter(value: string): string {
  return value.replace(/[,*%_]/g, " ").trim();
}

// GET: list students with their project_access_expires_at status.
// Optional ?q= for server-side search by username/email/full_name.
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

    const rawQuery = request.nextUrl.searchParams.get("q") ?? "";
    const q = escapeForOrFilter(rawQuery).slice(0, 80);

    const serviceSupabase = createServiceRoleClient(token);
    let query = serviceSupabase
      .from("profiles")
      .select("id, username, avatar_url, project_access_expires_at, created_at")
      .eq("role", "student");

    // email/full_name are NULL on profiles (PII encrypted) — search by username only.
    // A separate admin RPC is required for searching encrypted PII; tracked as follow-up.
    if (q) {
      query = query.ilike("username", `%${q}%`);
    }

    const { data, error } = await query
      .order("project_access_expires_at", {
        ascending: false,
        nullsFirst: false,
      })
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("[Student Project Access API] select error:", error);
      return NextResponse.json({ error: "An error occurred" }, { status: 500 });
    }

    const baseStudents = data || [];
    const ids = baseStudents.map((s) => s.id);
    let students: any[] = baseStudents;
    if (ids.length > 0) {
      const { data: decrypted, error: decErr } = await serviceSupabase.rpc(
        "get_decrypted_profiles",
        { p_user_ids: ids },
      );
      if (decErr) {
        console.error(
          "[Student Project Access API] decrypt rpc error:",
          decErr,
        );
      }
      const decryptedRows: any[] = decrypted || [];
      const byId = new Map<string, any>(decryptedRows.map((d) => [d.id, d]));
      students = baseStudents.map((s) => ({
        ...s,
        email: byId.get(s.id)?.email ?? null,
        full_name: byId.get(s.id)?.full_name ?? null,
      }));
    }

    const now = Date.now();
    const counts = {
      total: students.length,
      active: 0,
      expired: 0,
      never: 0,
      expiringSoon: 0,
    };
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    for (const s of students) {
      if (!s.project_access_expires_at) {
        counts.never += 1;
        continue;
      }
      const t = Date.parse(s.project_access_expires_at);
      if (Number.isNaN(t)) {
        counts.never += 1;
        continue;
      }
      if (t > now) {
        counts.active += 1;
        if (t - now <= sevenDaysMs) counts.expiringSoon += 1;
      } else {
        counts.expired += 1;
      }
    }

    return NextResponse.json(
      { students, counts },
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
    console.error("[Student Project Access API] GET error:", err);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
