import { NextRequest, NextResponse } from "next/server";
import {
  verifyAdminRequest,
  isAuthError,
  internalError,
} from "@/lib/admin-auth";
import type { EngagementAnalytics, DateCount } from "@/types/analytics";

export const dynamic = "force-dynamic";

function groupByDate(items: { created_at: string }[]): DateCount[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const date = item.created_at.split("T")[0];
    map.set(date, (map.get(date) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminRequest(request);
    if (isAuthError(auth)) return auth;

    const { serviceSupabase } = auth;

    // Parse date range from query params (default: last 30 days)
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fromDate =
      searchParams.get("from") || thirtyDaysAgo.toISOString().split("T")[0];
    const toDate = searchParams.get("to") || now.toISOString().split("T")[0];
    const toEnd = toDate + "T23:59:59Z";

    // Run independent queries in parallel
    const [
      enrollmentRequestsResult,
      messagesResult,
      courseMessagesResult,
      enrollmentsResult,
      allCoursesResult,
      enrolledCourseIdsResult,
    ] = await Promise.all([
      // 1. Enrollment funnel — status counts within date range
      serviceSupabase
        .from("enrollment_requests")
        .select("status")
        .gte("created_at", fromDate)
        .lte("created_at", toEnd),

      // 2. Messages per day within date range
      serviceSupabase
        .from("messages")
        .select("created_at")
        .gte("created_at", fromDate)
        .lte("created_at", toEnd)
        .order("created_at", { ascending: true }),

      // 3. Messages by course within date range (for most active courses)
      serviceSupabase
        .from("messages")
        .select("course_id")
        .gte("created_at", fromDate)
        .lte("created_at", toEnd),

      // 4. Enrollments in date range (for avg enrollments per user)
      serviceSupabase
        .from("enrollments")
        .select("user_id")
        .gte("created_at", fromDate)
        .lte("created_at", toEnd),

      // 5. All courses (for zero enrollment detection — need full catalog)
      serviceSupabase.from("courses").select("id, title"),

      // 6. Enrolled course IDs in date range (for zero enrollment detection)
      serviceSupabase
        .from("enrollments")
        .select("course_id")
        .gte("created_at", fromDate)
        .lte("created_at", toEnd),
    ]);

    // --- Enrollment funnel ---
    const funnel = { pending: 0, approved: 0, rejected: 0 };
    for (const r of enrollmentRequestsResult.data || []) {
      if (r.status in funnel) funnel[r.status as keyof typeof funnel]++;
    }

    // --- Conversion rate (approved / decided) ---
    // Intentionally excludes pending: pending requests haven't been decided yet
    const totalDecided = funnel.approved + funnel.rejected;
    const conversionRate =
      totalDecided > 0
        ? Math.round((funnel.approved / totalDecided) * 10000) / 100
        : 0;

    // --- Messages per day ---
    const messagesPerDay = groupByDate(messagesResult.data || []);

    // --- Most active courses by message count ---
    const courseCountMap = new Map<string, number>();
    for (const m of courseMessagesResult.data || []) {
      if (m.course_id) {
        courseCountMap.set(
          m.course_id,
          (courseCountMap.get(m.course_id) || 0) + 1,
        );
      }
    }

    // Get course titles for active courses
    const courseIds = Array.from(courseCountMap.keys());
    let courseMap = new Map<string, string>();
    if (courseIds.length > 0) {
      const { data: courses } = await serviceSupabase
        .from("courses")
        .select("id, title")
        .in("id", courseIds);
      courseMap = new Map((courses || []).map((c) => [c.id, c.title]));
    }

    const mostActiveCourses = Array.from(courseCountMap.entries())
      .map(([courseId, messageCount]) => ({
        courseId,
        title: courseMap.get(courseId) || "Unknown",
        messageCount,
      }))
      .sort((a, b) => b.messageCount - a.messageCount)
      .slice(0, 10);

    // --- Average enrollments per user (date-filtered) ---
    const enrollments = enrollmentsResult.data || [];
    const uniqueUsers = new Set(enrollments.map((e) => e.user_id));
    const avgEnrollmentsPerUser =
      uniqueUsers.size > 0
        ? Math.round((enrollments.length / uniqueUsers.size) * 100) / 100
        : 0;

    // --- Courses with zero enrollments in this period ---
    const enrolledSet = new Set(
      (enrolledCourseIdsResult.data || []).map((e) => e.course_id),
    );
    const coursesWithZeroEnrollments = (allCoursesResult.data || [])
      .filter((c) => !enrolledSet.has(c.id))
      .map((c) => ({ courseId: c.id, title: c.title }));

    const result: EngagementAnalytics = {
      enrollmentFunnel: funnel,
      conversionRate,
      messagesPerDay,
      mostActiveCourses,
      avgEnrollmentsPerUser,
      coursesWithZeroEnrollments,
    };

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    });
  } catch (error) {
    return internalError("Analytics Engagement API", error);
  }
}
