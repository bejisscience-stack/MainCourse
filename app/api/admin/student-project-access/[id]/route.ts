import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import { getTokenFromHeader } from "@/lib/admin-auth";
import { isValidUUID } from "@/lib/validation";
import { adminLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAdminAction } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

const MAX_REASON_LENGTH = 300;
const MAX_EXTEND_DAYS = 365 * 100; // 100 years

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

interface PatchBody {
  expires_at?: string | null;
  extend_days?: number;
  reason?: string;
}

// PATCH: grant, extend, or revoke a student's project access.
// Body shapes (mutually exclusive between expires_at and extend_days):
//   { expires_at: ISO_STRING, reason?: string }   → set absolute expiry
//   { expires_at: null, reason?: string }         → revoke (clear column)
//   { extend_days: number, reason?: string }      → push expiry forward by N days
//                                                   (from current expires_at if active,
//                                                    otherwise from now)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params;
    if (!id || !isValidUUID(id)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    const { allowed: rateOk, retryAfterMs } = await adminLimiter.check(user.id);
    if (!rateOk) return rateLimitResponse(retryAfterMs);

    const body = (await request.json().catch(() => null)) as PatchBody | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const hasExpiresAt = Object.prototype.hasOwnProperty.call(
      body,
      "expires_at",
    );
    const hasExtendDays = typeof body.extend_days === "number";

    if (hasExpiresAt === hasExtendDays) {
      return NextResponse.json(
        {
          error: "Provide exactly one of { expires_at } or { extend_days }",
        },
        { status: 400 },
      );
    }

    const reason =
      typeof body.reason === "string"
        ? body.reason.trim().slice(0, MAX_REASON_LENGTH)
        : null;

    // Verify target is a student.
    const serviceSupabase = createServiceRoleClient(token);
    const { data: target, error: lookupError } = await serviceSupabase
      .from("profiles")
      .select("id, role, project_access_expires_at, email, username, full_name")
      .eq("id", id)
      .single();

    if (lookupError || !target) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }
    if (target.role !== "student") {
      return NextResponse.json(
        { error: "Target user is not a student" },
        { status: 400 },
      );
    }

    let newExpiresAt: string | null;
    const nowMs = Date.now();

    if (hasExpiresAt) {
      const value = body.expires_at;
      if (value === null) {
        newExpiresAt = null;
      } else if (typeof value === "string") {
        const parsed = Date.parse(value);
        if (Number.isNaN(parsed)) {
          return NextResponse.json(
            { error: "expires_at must be a valid ISO timestamp or null" },
            { status: 400 },
          );
        }
        if (parsed <= nowMs) {
          return NextResponse.json(
            { error: "expires_at must be in the future" },
            { status: 400 },
          );
        }
        newExpiresAt = new Date(parsed).toISOString();
      } else {
        return NextResponse.json(
          { error: "expires_at must be an ISO string or null" },
          { status: 400 },
        );
      }
    } else {
      const days = body.extend_days as number;
      if (!Number.isFinite(days) || days <= 0 || days > MAX_EXTEND_DAYS) {
        return NextResponse.json(
          { error: `extend_days must be between 1 and ${MAX_EXTEND_DAYS}` },
          { status: 400 },
        );
      }
      const baseMs =
        target.project_access_expires_at &&
        Date.parse(target.project_access_expires_at) > nowMs
          ? Date.parse(target.project_access_expires_at)
          : nowMs;
      newExpiresAt = new Date(
        baseMs + days * 24 * 60 * 60 * 1000,
      ).toISOString();
    }

    // No-op short-circuit: same value already stored.
    if (
      target.project_access_expires_at === newExpiresAt ||
      (target.project_access_expires_at == null && newExpiresAt == null)
    ) {
      return NextResponse.json({
        success: true,
        unchanged: true,
        student: target,
      });
    }

    const { data: updated, error: updateError } = await serviceSupabase
      .from("profiles")
      .update({
        project_access_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(
        "id, email, username, full_name, avatar_url, project_access_expires_at, created_at",
      )
      .single();

    if (updateError || !updated) {
      console.error("[Student Project Access API] update error:", updateError);
      return NextResponse.json({ error: "An error occurred" }, { status: 500 });
    }

    const isRevoke = newExpiresAt === null;
    const action = isRevoke
      ? "revoke_student_project_access"
      : "grant_student_project_access";

    // Audit log first (failures are non-fatal). Then notification.
    await logAdminAction(request, user.id, action, "profiles", id, {
      previous_expires_at: target.project_access_expires_at,
      new_expires_at: newExpiresAt,
      mode: hasExtendDays ? "extend" : "set",
      extend_days: hasExtendDays ? body.extend_days : null,
      reason,
    });

    try {
      if (isRevoke) {
        await serviceSupabase.rpc("create_notification", {
          p_user_id: id,
          p_type: "subscription_rejected",
          p_title_en: "Project Access Revoked",
          p_title_ge: "პროექტებზე წვდომა გაუქმდა",
          p_message_en:
            "Your free project access has been revoked by an administrator.",
          p_message_ge:
            "თქვენი უფასო წვდომა პროექტებზე ადმინისტრატორმა გააუქმა.",
          p_metadata: {
            grant_type: "admin_free",
            previous_expires_at: target.project_access_expires_at,
            reason,
          },
          p_created_by: user.id,
        });
      } else {
        await serviceSupabase.rpc("create_notification", {
          p_user_id: id,
          p_type: "subscription_approved",
          p_title_en: "Project Access Granted",
          p_title_ge: "პროექტებზე წვდომა მოგენიჭათ",
          p_message_en: `An administrator granted you free project access until ${newExpiresAt}.`,
          p_message_ge: `ადმინისტრატორმა მოგანიჭათ უფასო წვდომა პროექტებზე — მოქმედებს ${newExpiresAt}-მდე.`,
          p_metadata: {
            grant_type: "admin_free",
            expires_at: newExpiresAt,
            reason,
          },
          p_created_by: user.id,
        });
      }
    } catch (notifyErr) {
      console.error(
        "[Student Project Access API] notification error (non-fatal):",
        notifyErr,
      );
    }

    return NextResponse.json({ success: true, student: updated });
  } catch (err) {
    console.error("[Student Project Access API] PATCH error:", err);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
