import { NextRequest, NextResponse } from "next/server";
import { getTokenFromHeader } from "@/lib/admin-auth";
import {
  verifyTokenAndGetUser,
  createServiceRoleClient,
  createServerSupabaseClient,
} from "@/lib/supabase-server";
import { isValidUUID } from "@/lib/validation";
import { notificationLimiter, rateLimitResponse } from "@/lib/rate-limit";

const SIGNED_URL_TTL_SECONDS = 3600; // 1h — matches the renderer's refresh buffer.

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path");

  if (!path) {
    return NextResponse.json(
      { error: "Missing path parameter" },
      { status: 400 },
    );
  }

  // chat-media path layout: {courseId}/{channelId}/{userId}/{filename}
  const normalizedPath = path
    .split("/")
    .filter((s) => s !== "." && s !== "..")
    .join("/");
  const segments = normalizedPath.split("/");
  if (segments.length < 4) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  const courseId = segments[0];
  const channelId = segments[1];
  if (!isValidUUID(courseId) || !isValidUUID(channelId)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const token = getTokenFromHeader(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { user, error: userError } = await verifyTokenAndGetUser(token);
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // A-18: cap signed-URL minting per user (60/60s) — same limiter as
  // /api/notifications. Well above legitimate render rate (client caches
  // signed URLs for ~50 min via Cache-Control).
  const { allowed: rateAllowed, retryAfterMs } =
    await notificationLimiter.check(user.id);
  if (!rateAllowed) return rateLimitResponse(retryAfterMs);

  // Authorization mirrors the chat-messages GET edge fn: admin OR course
  // lecturer OR enrolled student OR (projects channel + has_project_access).
  const supabase = createServerSupabaseClient(token);

  const { data: isAdminData } = await supabase.rpc("check_is_admin", {
    user_id: user.id,
  });
  let authorized = !!isAdminData;

  if (!authorized) {
    const { data: course } = await supabase
      .from("courses")
      .select("lecturer_id")
      .eq("id", courseId)
      .maybeSingle();

    if (course?.lecturer_id === user.id) {
      authorized = true;
    } else {
      const { data: enrollment } = await supabase
        .from("enrollments")
        .select("id, expires_at")
        .eq("user_id", user.id)
        .eq("course_id", courseId)
        .maybeSingle();

      const enrollmentValid =
        !!enrollment &&
        (enrollment.expires_at === null ||
          new Date(enrollment.expires_at) > new Date());

      if (enrollmentValid) {
        authorized = true;
      } else {
        // Project-access fallback: only meaningful when this attachment
        // belongs to the projects channel.
        const { data: channel } = await supabase
          .from("channels")
          .select("name")
          .eq("id", channelId)
          .maybeSingle();

        if (channel?.name?.toLowerCase() === "projects") {
          const { data: hasAccess } = await supabase.rpc("has_project_access", {
            uid: user.id,
          });
          if (hasAccess) authorized = true;
        }
      }
    }
  }

  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const serviceSupabase = createServiceRoleClient(token);
  const { data, error } = await serviceSupabase.storage
    .from("chat-media")
    .createSignedUrl(normalizedPath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    console.error("[chat-media/sign] Signed URL error:", error);
    return NextResponse.json(
      { error: "Failed to generate signed URL" },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { signedUrl: data.signedUrl },
    {
      headers: {
        // Cache 50 min — slightly less than the client's 50 min refresh buffer
        // so the next render fetches a fresh URL before the 1h signed URL TTL.
        "Cache-Control": "private, max-age=3000",
      },
    },
  );
}
