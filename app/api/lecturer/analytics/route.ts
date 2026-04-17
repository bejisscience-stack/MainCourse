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

    // 3. Revenue from balance_transactions — the same source used for payouts.
    //    transaction_type is 'credit'|'debit'; the semantic category is `source`.
    //    Filter to credits from course_purchase + referral_commission.
    let balanceQuery = supabase
      .from("balance_transactions")
      .select("amount, source, reference_id, reference_type, created_at")
      .eq("user_id", lecturerId)
      .eq("transaction_type", "credit")
      .in("source", ["course_purchase", "referral_commission"]);

    if (fromDate) balanceQuery = balanceQuery.gte("created_at", fromDate);
    if (toEnd) balanceQuery = balanceQuery.lte("created_at", toEnd);

    const { data: transactions, error: txError } = await balanceQuery;
    if (txError) {
      return NextResponse.json(
        { error: "Failed to fetch transactions" },
        { status: 500 },
      );
    }

    // Total + timeline across both sources.
    let totalRevenue = 0;
    const revenueByDate: Record<string, number> = {};

    (transactions || []).forEach((tx) => {
      const amt = Number(tx.amount);
      totalRevenue += amt;
      const date = tx.created_at.split("T")[0];
      revenueByDate[date] = (revenueByDate[date] || 0) + amt;
    });

    const revenueOverTime = Object.entries(revenueByDate)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Per-course revenue from the SAME stream, joined via enrollment_requests.
    // Referral commissions are not tied to a specific course, so they appear
    // only in totalRevenue. Bundle sales that reference non-enrollment_request
    // rows likewise drop out per-course (expected; they still count in total).
    const refIds = Array.from(
      new Set(
        (transactions || [])
          .filter(
            (tx) =>
              tx.source === "course_purchase" &&
              tx.reference_type === "enrollment_request" &&
              tx.reference_id,
          )
          .map((tx) => tx.reference_id as string),
      ),
    );

    const refToCourse = new Map<string, string>();
    if (refIds.length > 0) {
      const { data: refRows, error: refErr } = await supabase
        .from("enrollment_requests")
        .select("id, course_id")
        .in("id", refIds);
      if (refErr) {
        return NextResponse.json(
          { error: "Failed to fetch enrollment references" },
          { status: 500 },
        );
      }
      (refRows || []).forEach((r) => refToCourse.set(r.id, r.course_id));
    }

    const revenueByCourse: Record<string, number> = {};
    (transactions || []).forEach((tx) => {
      if (tx.source !== "course_purchase" || !tx.reference_id) return;
      const courseId = refToCourse.get(tx.reference_id as string);
      if (!courseId) return;
      revenueByCourse[courseId] =
        (revenueByCourse[courseId] || 0) + Number(tx.amount);
    });

    // 4. Current balance — read profiles.balance, the canonical source
    //    maintained atomically by credit_user_balance / debit_user_balance RPCs.
    //    Summing balance_transactions.amount is wrong because amount is stored
    //    as an unsigned magnitude with direction carried by transaction_type.
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("balance")
      .eq("id", lecturerId)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { error: "Failed to fetch balance" },
        { status: 500 },
      );
    }

    const currentBalance = Number(profile?.balance ?? 0);

    // 5. Build course performance — revenue comes from balance_transactions
    //    (net lecturer share, historical price), not enrollments * current price.
    const coursePerformance = (courses || []).map((course) => ({
      courseId: course.id,
      title: course.title,
      enrollmentCount: enrollmentsByCourse[course.id] || 0,
      revenue: revenueByCourse[course.id] || 0,
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
