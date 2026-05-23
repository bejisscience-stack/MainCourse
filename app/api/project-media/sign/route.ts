import { NextRequest, NextResponse } from "next/server";
import { getTokenFromHeader } from "@/lib/admin-auth";
import {
  verifyTokenAndGetUser,
  createServiceRoleClient,
  createServerSupabaseClient,
} from "@/lib/supabase-server";
import { isValidUUID } from "@/lib/validation";

const SIGNED_URL_TTL_SECONDS = 3600;

function normalizePath(path: string): string {
  return path
    .split("/")
    .filter((s) => s !== "." && s !== "..")
    .join("/");
}

function isActiveProjectDates(
  startDate: string | null,
  endDate: string | null,
): boolean {
  if (!startDate || !endDate) return false;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tbilisi",
  }).format(new Date());
  return today >= startDate && today <= endDate;
}

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path");
  const projectId = request.nextUrl.searchParams.get("projectId");

  if (!path || !projectId) {
    return NextResponse.json(
      { error: "Missing path or projectId parameter" },
      { status: 400 },
    );
  }

  if (!isValidUUID(projectId)) {
    return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
  }

  const normalizedPath = normalizePath(path);
  if (!normalizedPath) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const serviceSupabase = createServiceRoleClient();

  const { data: resourceRow, error: resourceError } = await serviceSupabase
    .from("project_resources")
    .select("id, url, project_id, resource_type")
    .eq("project_id", projectId)
    .eq("url", normalizedPath)
    .maybeSingle();

  if (resourceError || !resourceRow) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  // SEC: link resources are external http(s) URLs, never storage paths. The
  // sign endpoint must refuse to mint signed URLs for them.
  if (resourceRow.resource_type === "link") {
    return NextResponse.json(
      { error: "Cannot sign link resource" },
      { status: 400 },
    );
  }

  const { data: project, error: projectError } = await serviceSupabase
    .from("projects")
    .select("id, user_id, course_id, start_date, end_date, status")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // SEC: prevent storage-path laundering. A malicious project owner could have
  // inserted project_resources.url = "<other-course>/<channel>/<user>/<file>"
  // to alias a chat-media object outside their namespace. Enforce that the
  // path lives in the project's expected storage namespace:
  //   - standalone projects   → standalone-projects/{project.user_id}/...
  //   - legacy course-bound   → {project.course_id}/...
  const expectedPrefix = project.course_id
    ? `${project.course_id}/`
    : `standalone-projects/${project.user_id}/`;
  if (!normalizedPath.startsWith(expectedPrefix)) {
    return NextResponse.json(
      { error: "Invalid resource path" },
      { status: 403 },
    );
  }

  const isPublicActive =
    project.status === "active" &&
    isActiveProjectDates(project.start_date, project.end_date);

  const token = getTokenFromHeader(request);
  let authorized = isPublicActive;

  if (!authorized && token) {
    const { user, error: userError } = await verifyTokenAndGetUser(token);
    if (!userError && user) {
      if (project.user_id === user.id) {
        authorized = true;
      } else {
        const supabase = createServerSupabaseClient(token);
        const { data: isAdminData } = await supabase.rpc("check_is_admin", {
          user_id: user.id,
        });
        if (isAdminData) {
          authorized = true;
        } else if (project.course_id) {
          const { data: course } = await supabase
            .from("courses")
            .select("lecturer_id")
            .eq("id", project.course_id)
            .maybeSingle();
          if (course?.lecturer_id === user.id) authorized = true;

          if (!authorized) {
            const { data: enrollment } = await supabase
              .from("enrollments")
              .select("id, expires_at")
              .eq("user_id", user.id)
              .eq("course_id", project.course_id)
              .maybeSingle();
            authorized =
              !!enrollment &&
              (enrollment.expires_at === null ||
                new Date(enrollment.expires_at) > new Date());
          }
        }

        if (!authorized) {
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

  const { data, error } = await serviceSupabase.storage
    .from("chat-media")
    .createSignedUrl(normalizedPath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    console.error("[project-media/sign] Signed URL error:", error);
    return NextResponse.json(
      { error: "Failed to generate signed URL" },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { signedUrl: data.signedUrl },
    {
      headers: {
        "Cache-Control": "private, max-age=3000",
      },
    },
  );
}
