import { NextRequest, NextResponse } from "next/server";
import {
  verifyAdminRequest,
  isAuthError,
  internalError,
} from "@/lib/admin-auth";
import type { OperationalAnalytics } from "@/types/analytics";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminRequest(request);
    if (isAuthError(auth)) return auth;
    const { serviceSupabase } = auth;

    const [
      { data: pendingEnrollmentData },
      { data: pendingWithdrawalData },
      { data: pendingLecturerData },
      { data: processedEnrollments },
      { data: processedWithdrawals },
    ] = await Promise.all([
      // 1. Pending enrollment requests
      serviceSupabase
        .from("enrollment_requests")
        .select("created_at")
        .eq("status", "pending"),

      // 2. Pending withdrawal requests
      serviceSupabase
        .from("withdrawal_requests")
        .select("created_at, amount")
        .eq("status", "pending"),

      // 3. Pending lecturer approvals
      serviceSupabase
        .from("profiles")
        .select("created_at")
        .eq("lecturer_status", "pending"),

      // 4. Processed enrollments (for avg processing time)
      serviceSupabase
        .from("enrollment_requests")
        .select("created_at, reviewed_at")
        .neq("status", "pending")
        .not("reviewed_at", "is", null),

      // 5. Processed withdrawals (for avg processing time)
      serviceSupabase
        .from("withdrawal_requests")
        .select("created_at, processed_at")
        .neq("status", "pending")
        .not("processed_at", "is", null),
    ]);

    // Helper: find oldest created_at and compute age in hours
    function oldestAgeHours(items: { created_at: string }[] | null): number {
      if (!items || items.length === 0) return 0;
      let oldest = items[0].created_at;
      for (let i = 1; i < items.length; i++) {
        if (items[i].created_at < oldest) oldest = items[i].created_at;
      }
      return (
        Math.round(
          ((Date.now() - new Date(oldest).getTime()) / (1000 * 60 * 60)) * 10,
        ) / 10
      );
    }

    // --- Pending enrollments ---
    const pendingEnrollmentCount = pendingEnrollmentData?.length || 0;
    const enrollmentAgeHours = oldestAgeHours(pendingEnrollmentData);

    // --- Pending withdrawals ---
    const pendingWithdrawalCount = pendingWithdrawalData?.length || 0;
    const totalPendingAmount =
      Math.round(
        (pendingWithdrawalData || []).reduce(
          (sum, w) => sum + Number(w.amount),
          0,
        ) * 100,
      ) / 100;
    const withdrawalAgeHours = oldestAgeHours(pendingWithdrawalData);

    // --- Pending lecturers ---
    const pendingLecturerCount = pendingLecturerData?.length || 0;
    const lecturerAgeHours = oldestAgeHours(pendingLecturerData);

    // --- Average enrollment processing time ---
    let totalEnrollmentHours = 0;
    for (const e of processedEnrollments || []) {
      if (e.reviewed_at) {
        totalEnrollmentHours +=
          (new Date(e.reviewed_at).getTime() -
            new Date(e.created_at).getTime()) /
          (1000 * 60 * 60);
      }
    }
    const avgEnrollmentProcessingHours = processedEnrollments?.length
      ? Math.round((totalEnrollmentHours / processedEnrollments.length) * 10) /
        10
      : 0;

    // --- Average withdrawal processing time ---
    let totalWithdrawalHours = 0;
    for (const w of processedWithdrawals || []) {
      if (w.processed_at) {
        totalWithdrawalHours +=
          (new Date(w.processed_at).getTime() -
            new Date(w.created_at).getTime()) /
          (1000 * 60 * 60);
      }
    }
    const avgWithdrawalProcessingHours = processedWithdrawals?.length
      ? Math.round((totalWithdrawalHours / processedWithdrawals.length) * 10) /
        10
      : 0;

    const result: OperationalAnalytics = {
      pendingEnrollments: {
        count: pendingEnrollmentCount,
        oldestAgeHours: enrollmentAgeHours,
      },
      pendingWithdrawals: {
        count: pendingWithdrawalCount,
        oldestAgeHours: withdrawalAgeHours,
        totalAmount: totalPendingAmount,
      },
      pendingLecturers: {
        count: pendingLecturerCount,
        oldestAgeHours: lecturerAgeHours,
      },
      avgEnrollmentProcessingHours,
      avgWithdrawalProcessingHours,
    };

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    });
  } catch (error) {
    return internalError("Analytics Operational API", error);
  }
}
