import { NextRequest, NextResponse } from "next/server";
import {
  createServiceRoleClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import type { LecturerAnalytics } from "@/types/analytics";

export const dynamic = "force-dynamic";

function getTokenFromHeader(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

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

    const supabase = createServiceRoleClient(token);
    const lecturerId = user.id;

    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get("from");
    const toDate = searchParams.get("to");
    const toEnd = toDate ? toDate + "T23:59:59Z" : undefined;

    // 1. Get lecturer's courses
    const { data: courses, error: coursesError } = await supabase
      .from("courses")
      .select("id, title, rating, review_count, price")
      .eq("lecturer_id", lecturerId);

    if (coursesError) {
      return NextResponse.json(
        { error: "Failed to fetch courses" },
        { status: 500 },
      );
    }

    const courseIds = (courses || []).map((c) => c.id);
    const activeCourses = courses?.length ?? 0;

    // 2. Get enrollment counts per course (approved only)
    let enrollments: Array<{ id: string; course_id: string }> = [];
    if (courseIds.length > 0) {
      let enrollmentQuery = supabase
        .from("enrollment_requests")
        .select("id, course_id")
        .eq("status", "approved")
        .in("course_id", courseIds);

      if (fromDate)
        enrollmentQuery = enrollmentQuery.gte("created_at", fromDate);
      if (toEnd) enrollmentQuery = enrollmentQuery.lte("created_at", toEnd);

      const { data, error: enrollError } = await enrollmentQuery;
      if (enrollError) {
        console.error("Enrollment query error:", enrollError);
        return NextResponse.json(
          { error: "Failed to fetch enrollments" },
          { status: 500 },
        );
      }
      enrollments = data || [];
    }

    const enrollmentsByCourse: Record<string, number> = {};
    enrollments.forEach((e) => {
      enrollmentsByCourse[e.course_id] =
        (enrollmentsByCourse[e.course_id] || 0) + 1;
    });
    const totalEnrollments = enrollments.length;

    // 3. Get balance transactions for revenue over time
    let balanceQuery = supabase
      .from("balance_transactions")
      .select("amount, transaction_type, created_at")
      .eq("user_id", lecturerId);

    if (fromDate) balanceQuery = balanceQuery.gte("created_at", fromDate);
    if (toEnd) balanceQuery = balanceQuery.lte("created_at", toEnd);

    const { data: transactions, error: txError } = await balanceQuery;
    if (txError) {
      return NextResponse.json(
        { error: "Failed to fetch transactions" },
        { status: 500 },
      );
    }

    // Calculate total revenue (course_purchase + referral_commission credits)
    let totalRevenue = 0;
    const revenueByDate: Record<string, number> = {};

    (transactions || []).forEach((tx) => {
      if (
        tx.transaction_type === "course_purchase" ||
        tx.transaction_type === "referral_commission"
      ) {
        totalRevenue += tx.amount;
        const date = tx.created_at.split("T")[0];
        revenueByDate[date] = (revenueByDate[date] || 0) + tx.amount;
      }
    });

    const revenueOverTime = Object.entries(revenueByDate)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 4. Calculate current balance (all-time, not date-filtered)
    const { data: allTransactions, error: allTxError } = await supabase
      .from("balance_transactions")
      .select("amount")
      .eq("user_id", lecturerId);

    const currentBalance = (allTransactions || []).reduce(
      (sum, tx) => sum + tx.amount,
      0,
    );

    // 5. Build course performance
    const coursePerformance = (courses || []).map((course) => ({
      courseId: course.id,
      title: course.title,
      enrollmentCount: enrollmentsByCourse[course.id] || 0,
      revenue: (enrollmentsByCourse[course.id] || 0) * (course.price || 0),
      rating: course.rating || 0,
      reviewCount: course.review_count || 0,
    }));

    // Sort by revenue descending
    coursePerformance.sort((a, b) => b.revenue - a.revenue);

    const result: LecturerAnalytics = {
      overview: {
        totalRevenue,
        totalEnrollments,
        activeCourses,
        currentBalance,
      },
      coursePerformance,
      revenueOverTime,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Lecturer analytics error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
