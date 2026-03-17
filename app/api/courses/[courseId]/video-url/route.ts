import { NextRequest, NextResponse } from "next/server";
import { getTokenFromHeader } from "@/lib/admin-auth";
import {
  verifyTokenAndGetUser,
  createServiceRoleClient,
  createServerSupabaseClient,
} from "@/lib/supabase-server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await params;
  const videoPath = request.nextUrl.searchParams.get("videoPath");

  if (!videoPath) {
    return NextResponse.json(
      { error: "Missing videoPath parameter" },
      { status: 400 },
    );
  }

  const normalizedPath = videoPath
    .split("/")
    .filter((s) => s !== "." && s !== "..")
    .join("/");
  if (!normalizedPath.startsWith(courseId + "/")) {
    return NextResponse.json({ error: "Invalid video path" }, { status: 400 });
  }

  // Auth
  const token = getTokenFromHeader(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { user, error: userError } = await verifyTokenAndGetUser(token);
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Authorization: enrolled, lecturer, or admin
  const supabase = createServerSupabaseClient(token);

  const [enrollmentResult, courseResult, adminResult] = await Promise.all([
    supabase
      .from("enrollments")
      .select("id")
      .eq("course_id", courseId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("courses")
      .select("lecturer_id")
      .eq("id", courseId)
      .maybeSingle(),
    supabase.rpc("check_is_admin", { user_id: user.id }),
  ]);

  const isEnrolled = !!enrollmentResult.data;
  const isLecturer = courseResult.data?.lecturer_id === user.id;
  const isAdmin = adminResult.data === true;

  if (!isEnrolled && !isLecturer && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Sign URL with service role (bypasses RLS)
  const serviceSupabase = createServiceRoleClient(token);
  const { data, error } = await serviceSupabase.storage
    .from("course-videos")
    .createSignedUrl(normalizedPath, 3600); // 1 hour expiry for paid content protection

  if (error || !data?.signedUrl) {
    console.error("[video-url] Signed URL error:", error);
    return NextResponse.json(
      { error: "Failed to generate video URL" },
      { status: 500 },
    );
  }

  return NextResponse.json({ signedUrl: data.signedUrl });
}
