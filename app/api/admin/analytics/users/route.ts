import { NextRequest, NextResponse } from "next/server";
import {
  verifyAdminRequest,
  isAuthError,
  internalError,
} from "@/lib/admin-auth";
import type { UserAnalytics, DateCount, RoleCount } from "@/types/analytics";

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

    // Run independent queries in parallel
    const [
      totalUsersResult,
      profilesResult,
      completedResult,
      signupDataResult,
    ] = await Promise.all([
      // 1. Total users
      serviceSupabase
        .from("profiles")
        .select("*", { count: "exact", head: true }),

      // 2. Role distribution
      serviceSupabase.from("profiles").select("role"),

      // 3. Profile completion rate
      serviceSupabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("profile_completed", true),

      // 4. New signups per day in range
      serviceSupabase
        .from("profiles")
        .select("created_at")
        .gte("created_at", fromDate)
        .lte("created_at", toDate + "T23:59:59Z")
        .order("created_at", { ascending: true }),
    ]);

    const totalUsers = totalUsersResult.count || 0;

    // Role distribution
    const roleMap = new Map<string, number>();
    for (const profile of profilesResult.data || []) {
      const role = profile.role || "unknown";
      roleMap.set(role, (roleMap.get(role) || 0) + 1);
    }
    const roleDistribution: RoleCount[] = Array.from(roleMap.entries())
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => b.count - a.count);

    // Profile completion rate
    const completedCount = completedResult.count || 0;
    const profileCompletionRate =
      totalUsers > 0
        ? Math.round((completedCount / totalUsers) * 10000) / 100
        : 0;

    // New signups grouped by date
    const signupData = signupDataResult.data || [];
    const newSignups = groupByDate(signupData);

    // DAU / WAU / MAU via auth admin API
    const oneDayAgo = new Date(
      now.getTime() - 24 * 60 * 60 * 1000,
    ).toISOString();
    const sevenDaysAgo = new Date(
      now.getTime() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const thirtyDaysAgoISO = new Date(
      now.getTime() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    let allUsers: { last_sign_in_at?: string }[] = [];
    let page = 1;
    while (true) {
      const {
        data: { users },
        error,
      } = await serviceSupabase.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (error || !users?.length) break;
      allUsers = allUsers.concat(
        users.map((u) => ({ last_sign_in_at: u.last_sign_in_at })),
      );
      if (users.length < 1000) break;
      page++;
    }

    const dau = allUsers.filter(
      (u) => u.last_sign_in_at && u.last_sign_in_at >= oneDayAgo,
    ).length;
    const wau = allUsers.filter(
      (u) => u.last_sign_in_at && u.last_sign_in_at >= sevenDaysAgo,
    ).length;
    const mau = allUsers.filter(
      (u) => u.last_sign_in_at && u.last_sign_in_at >= thirtyDaysAgoISO,
    ).length;

    // Stickiness (guard division by zero)
    const stickiness = mau > 0 ? Math.round((dau / mau) * 10000) / 100 : 0;

    // Signup growth rate: compare current period vs prior period of same length
    const periodLength =
      new Date(toDate).getTime() - new Date(fromDate).getTime();
    const priorFrom = new Date(new Date(fromDate).getTime() - periodLength)
      .toISOString()
      .split("T")[0];

    const { count: priorCount } = await serviceSupabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", priorFrom)
      .lt("created_at", fromDate);

    const currentCount = signupData.length;
    const signupGrowthRate =
      priorCount && priorCount > 0
        ? Math.round(((currentCount - priorCount) / priorCount) * 10000) / 100
        : 0;

    const result: UserAnalytics = {
      totalUsers,
      newSignups,
      roleDistribution,
      dau,
      wau,
      mau,
      stickiness,
      signupGrowthRate,
      profileCompletionRate,
    };

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    });
  } catch (error) {
    return internalError("Analytics Users API", error);
  }
}
