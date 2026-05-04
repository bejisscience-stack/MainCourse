import { NextRequest, NextResponse } from "next/server";
import {
  verifyAdminRequest,
  isAuthError,
  internalError,
} from "@/lib/admin-auth";
import {
  fetchGrossRevenuePayments,
  grossPaymentAmount,
} from "@/lib/admin-analytics";
import type { AnalyticsOverview } from "@/types/analytics";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminRequest(request);
    if (isAuthError(auth)) return auth;

    const { serviceSupabase } = auth;

    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get("from");
    const toDate = searchParams.get("to");

    let referralQuery = serviceSupabase
      .from("referrals")
      .select("*", { count: "exact", head: true });

    let projectQuery = serviceSupabase.from("projects").select("id, budget");

    if (fromDate) {
      referralQuery = referralQuery.gte("created_at", fromDate);
      projectQuery = projectQuery.gte("created_at", fromDate);
    }
    if (toDate) {
      const toEnd = toDate + "T23:59:59Z";
      referralQuery = referralQuery.lte("created_at", toEnd);
      projectQuery = projectQuery.lte("created_at", toEnd);
    }

    const [
      waitingListResult,
      referralsResult,
      projectsResult,
      grossPayments,
    ] = await Promise.all([
      serviceSupabase
        .from("coming_soon_emails")
        .select("*", { count: "exact", head: true }),
      referralQuery,
      projectQuery,
      fetchGrossRevenuePayments(serviceSupabase, { fromDate, toDate }),
    ]);

    const coursePayments = grossPayments.filter(
      (payment) => payment.payment_type === "course_enrollment",
    );
    const bundlePayments = grossPayments.filter(
      (payment) => payment.payment_type === "bundle_enrollment",
    );
    const totalRevenue = coursePayments.reduce(
      (sum, payment) => sum + grossPaymentAmount(payment),
      0,
    );
    const totalBundleRevenue = bundlePayments.reduce(
      (sum, payment) => sum + grossPaymentAmount(payment),
      0,
    );

    const projects = projectsResult.data || [];
    const totalProjectBudget = projects.reduce(
      (sum: number, p: Record<string, any>) => {
        return sum + Number(p.budget || 0);
      },
      0,
    );

    const overview: AnalyticsOverview = {
      waitingListCount: waitingListResult.count || 0,
      totalRevenue,
      totalEnrollments: coursePayments.length,
      totalReferrals: referralsResult.count || 0,
      totalProjects: projects.length,
      totalProjectBudget,
      totalBundleRevenue,
      totalBundleEnrollments: bundlePayments.length,
    };

    return NextResponse.json(overview, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    });
  } catch (error) {
    return internalError("Analytics Overview API", error);
  }
}
