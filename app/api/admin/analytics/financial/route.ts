import { NextRequest, NextResponse } from "next/server";
import {
  verifyAdminRequest,
  isAuthError,
  internalError,
} from "@/lib/admin-auth";
import type { FinancialAnalytics, BalanceFlowDay } from "@/types/analytics";

export const dynamic = "force-dynamic";

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

    // Run independent queries in parallel — ALL queries respect date range
    const [
      approvedEnrollmentsResult,
      approvedBundlesResult,
      transactionsResult,
      balancesResult,
      withdrawalsResult,
    ] = await Promise.all([
      // 1. Approved enrollments in date range (for revenue over time + by lecturer + AOV + totalEarned)
      serviceSupabase
        .from("enrollment_requests")
        .select("created_at, course_id, courses(price, lecturer_id)")
        .eq("status", "approved")
        .gte("created_at", fromDate)
        .lte("created_at", toEnd),

      // 2. Approved bundle enrollments in date range
      serviceSupabase
        .from("bundle_enrollment_requests")
        .select("created_at, course_bundles(price)")
        .eq("status", "approved")
        .gte("created_at", fromDate)
        .lte("created_at", toEnd),

      // 3. Balance transactions in date range
      serviceSupabase
        .from("balance_transactions")
        .select("created_at, amount, source")
        .gte("created_at", fromDate)
        .lte("created_at", toEnd),

      // 4. Outstanding balances — all profiles with positive balance (intentionally all-time: current liability)
      serviceSupabase.from("profiles").select("balance").gt("balance", 0),

      // 5. Withdrawals in date range (for trend + avg amount + total paid out)
      serviceSupabase
        .from("withdrawal_requests")
        .select("created_at, amount, status")
        .gte("created_at", fromDate)
        .lte("created_at", toEnd),
    ]);

    const approvedEnrollments = approvedEnrollmentsResult.data || [];
    const approvedBundles = approvedBundlesResult.data || [];

    // --- 1. Revenue over time (daily aggregation) ---
    const revenueMap = new Map<string, number>();
    for (const e of approvedEnrollments) {
      const date = e.created_at.split("T")[0];
      const price = Number((e.courses as any)?.price || 0);
      revenueMap.set(date, (revenueMap.get(date) || 0) + price);
    }
    for (const b of approvedBundles) {
      const date = b.created_at.split("T")[0];
      const price = Number((b.course_bundles as any)?.price || 0);
      revenueMap.set(date, (revenueMap.get(date) || 0) + price);
    }
    const revenueOverTime = Array.from(revenueMap.entries())
      .map(([date, amount]) => ({
        date,
        amount: Math.round(amount * 100) / 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // --- 2. Revenue by lecturer (same date-filtered enrollments) ---
    const lecturerMap = new Map<string, number>();
    for (const e of approvedEnrollments) {
      const lecturerId = (e.courses as any)?.lecturer_id;
      const price = Number((e.courses as any)?.price || 0);
      if (lecturerId) {
        lecturerMap.set(lecturerId, (lecturerMap.get(lecturerId) || 0) + price);
      }
    }

    // Get lecturer names
    const lecturerIds = Array.from(lecturerMap.keys());
    const { data: lecturerProfiles } = await serviceSupabase
      .from("profiles")
      .select("id, full_name, username")
      .in("id", lecturerIds.length > 0 ? lecturerIds : ["none"]);

    const nameMap = new Map(
      (lecturerProfiles || []).map((p) => [
        p.id,
        p.full_name || p.username || "Unknown",
      ]),
    );
    const revenueByLecturer = Array.from(lecturerMap.entries())
      .map(([lecturerId, revenue]) => ({
        lecturerId,
        name: nameMap.get(lecturerId) || "Unknown",
        revenue: Math.round(revenue * 100) / 100,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // --- 3. Average order value (from date-filtered enrollments + bundles) ---
    const totalRevenue = revenueOverTime.reduce((sum, d) => sum + d.amount, 0);
    const totalOrders = approvedEnrollments.length + approvedBundles.length;
    const averageOrderValue =
      totalOrders > 0
        ? Math.round((totalRevenue / totalOrders) * 100) / 100
        : 0;

    // --- 4. Balance flow by source (keep real sign — no Math.abs) ---
    const flowMap = new Map<string, BalanceFlowDay>();
    for (const t of transactionsResult.data || []) {
      const date = t.created_at.split("T")[0];
      if (!flowMap.has(date)) {
        flowMap.set(date, {
          date,
          referral_commission: 0,
          course_purchase: 0,
          withdrawal: 0,
          admin_adjustment: 0,
        });
      }
      const day = flowMap.get(date)!;
      const amount = Number(t.amount);
      const source = t.source as keyof Omit<BalanceFlowDay, "date">;
      if (source in day && source !== ("date" as string)) {
        (day as any)[source] += amount;
      }
    }
    const balanceFlow = Array.from(flowMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        ...d,
        referral_commission: Math.round(d.referral_commission * 100) / 100,
        course_purchase: Math.round(d.course_purchase * 100) / 100,
        withdrawal: Math.round(d.withdrawal * 100) / 100,
        admin_adjustment: Math.round(d.admin_adjustment * 100) / 100,
      }));

    // --- 5. Outstanding balances (intentionally all-time: shows current liability) ---
    const outstandingBalances = (balancesResult.data || []).reduce(
      (sum, p) => sum + Number(p.balance || 0),
      0,
    );

    // --- 6. Withdrawal trend (date-filtered) ---
    const withdrawals = withdrawalsResult.data || [];
    const wMap = new Map<string, { amount: number; count: number }>();
    for (const w of withdrawals) {
      const date = w.created_at.split("T")[0];
      const entry = wMap.get(date) || { amount: 0, count: 0 };
      entry.amount += Number(w.amount);
      entry.count++;
      wMap.set(date, entry);
    }
    const withdrawalTrend = Array.from(wMap.entries())
      .map(([date, { amount, count }]) => ({
        date,
        amount: Math.round(amount * 100) / 100,
        count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // --- 7. Avg withdrawal amount + total paid out (from date-filtered withdrawals) ---
    // Status 'approved' or 'completed' = money was paid out
    const completedWithdrawals = withdrawals.filter(
      (w) => w.status === "approved" || w.status === "completed",
    );
    const totalPaidOut = completedWithdrawals.reduce(
      (sum, w) => sum + Number(w.amount),
      0,
    );
    const avgWithdrawalAmount =
      completedWithdrawals.length > 0
        ? Math.round((totalPaidOut / completedWithdrawals.length) * 100) / 100
        : 0;

    // --- 8. Total earned in period (from same date-filtered enrollments + bundles) ---
    const totalEarned = totalRevenue;

    const result: FinancialAnalytics = {
      revenueOverTime,
      revenueByLecturer,
      averageOrderValue,
      balanceFlow,
      outstandingBalances: Math.round(outstandingBalances * 100) / 100,
      withdrawalTrend,
      avgWithdrawalAmount,
      totalPaidOut: Math.round(totalPaidOut * 100) / 100,
      totalEarned: Math.round(totalEarned * 100) / 100,
    };

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    });
  } catch (error) {
    return internalError("Analytics Financial API", error);
  }
}
