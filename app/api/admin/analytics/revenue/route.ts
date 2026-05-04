import { NextRequest, NextResponse } from "next/server";
import {
  verifyAdminRequest,
  isAuthError,
  internalError,
} from "@/lib/admin-auth";
import {
  fetchGrossRevenuePayments,
  grossPaymentAmount,
  type GrossRevenuePayment,
} from "@/lib/admin-analytics";
import type {
  RevenueData,
  CourseRevenue,
  BundleRevenue,
} from "@/types/analytics";

export const dynamic = "force-dynamic";

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function fetchCourseRequestMap(
  serviceSupabase: any,
  payments: GrossRevenuePayment[],
): Promise<Map<string, Record<string, any>>> {
  const ids = Array.from(
    new Set(payments.map((payment) => payment.reference_id)),
  );
  const rows: Record<string, any>[] = [];

  for (const idChunk of chunk(ids, 200)) {
    const { data, error } = await serviceSupabase
      .from("enrollment_requests")
      .select("id, course_id, courses(id, title, course_type, price)")
      .in("id", idChunk);

    if (error) throw error;
    rows.push(...(data || []));
  }

  return new Map(rows.map((row) => [row.id, row]));
}

async function fetchBundleRequestMap(
  serviceSupabase: any,
  payments: GrossRevenuePayment[],
): Promise<Map<string, Record<string, any>>> {
  const ids = Array.from(
    new Set(payments.map((payment) => payment.reference_id)),
  );
  const rows: Record<string, any>[] = [];

  for (const idChunk of chunk(ids, 200)) {
    const { data, error } = await serviceSupabase
      .from("bundle_enrollment_requests")
      .select("id, bundle_id, course_bundles(id, title, price)")
      .in("id", idChunk);

    if (error) throw error;
    rows.push(...(data || []));
  }

  return new Map(rows.map((row) => [row.id, row]));
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminRequest(request);
    if (isAuthError(auth)) return auth;

    const { serviceSupabase } = auth;

    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get("from");
    const toDate = searchParams.get("to");

    const [grossPayments, coursesResult, bundlesResult] = await Promise.all([
      fetchGrossRevenuePayments(serviceSupabase, { fromDate, toDate }),
      serviceSupabase.from("courses").select("id, title, course_type, price"),
      serviceSupabase.from("course_bundles").select("id, title, price"),
    ]);

    const coursePayments = grossPayments.filter(
      (payment) => payment.payment_type === "course_enrollment",
    );
    const bundlePayments = grossPayments.filter(
      (payment) => payment.payment_type === "bundle_enrollment",
    );
    const [courseRequestMap, bundleRequestMap] = await Promise.all([
      fetchCourseRequestMap(serviceSupabase, coursePayments),
      fetchBundleRequestMap(serviceSupabase, bundlePayments),
    ]);

    const allCourses = coursesResult.data || [];

    // Initialize all courses with 0 revenue
    const courseRevenueMap = new Map<string, CourseRevenue>();
    for (const course of allCourses) {
      courseRevenueMap.set(course.id, {
        courseId: course.id,
        courseTitle: course.title,
        courseType: course.course_type,
        price: Number(course.price),
        enrollmentCount: 0,
        totalRevenue: 0,
      });
    }

    // Count gross paid Keepz enrollments and revenue per course.
    for (const payment of coursePayments) {
      const request = courseRequestMap.get(payment.reference_id);
      const courseId = request?.course_id || "unknown";
      const price = grossPaymentAmount(payment);
      const existing = courseRevenueMap.get(courseId);
      if (existing) {
        existing.enrollmentCount += 1;
        existing.totalRevenue += price;
      } else {
        courseRevenueMap.set(courseId, {
          courseId,
          courseTitle:
            (request?.courses as Record<string, any> | null)?.title ||
            "Unknown Course",
          courseType:
            (request?.courses as Record<string, any> | null)?.course_type ||
            "Unknown",
          price,
          enrollmentCount: 1,
          totalRevenue: price,
        });
      }
    }

    // Initialize all bundles with 0 revenue (consistent with courses)
    const allBundles = bundlesResult.data || [];
    const bundleRevenueMap = new Map<string, BundleRevenue>();
    for (const bundle of allBundles) {
      bundleRevenueMap.set(bundle.id, {
        bundleId: bundle.id,
        bundleTitle: bundle.title,
        price: Number(bundle.price),
        enrollmentCount: 0,
        totalRevenue: 0,
      });
    }

    // Aggregate gross paid Keepz bundle enrollments.
    for (const payment of bundlePayments) {
      const request = bundleRequestMap.get(payment.reference_id);
      const bundleId = request?.bundle_id || "unknown";
      const price = grossPaymentAmount(payment);
      const existing = bundleRevenueMap.get(bundleId);
      if (existing) {
        existing.enrollmentCount += 1;
        existing.totalRevenue += price;
      } else {
        bundleRevenueMap.set(bundleId, {
          bundleId,
          bundleTitle:
            (request?.course_bundles as Record<string, any> | null)?.title ||
            "Unknown Bundle",
          price,
          enrollmentCount: 1,
          totalRevenue: price,
        });
      }
    }

    const courses = Array.from(courseRevenueMap.values()).sort(
      (a, b) => b.totalRevenue - a.totalRevenue,
    );

    const totalRevenue = coursePayments.reduce(
      (sum, payment) => sum + grossPaymentAmount(payment),
      0,
    );
    const totalBundleRevenue = bundlePayments.reduce(
      (sum, payment) => sum + grossPaymentAmount(payment),
      0,
    );

    const data: RevenueData = {
      courses,
      totalRevenue,
      totalBundleRevenue,
      bundleRevenue: Array.from(bundleRevenueMap.values()).sort(
        (a, b) => b.totalRevenue - a.totalRevenue,
      ),
    };

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    });
  } catch (error) {
    return internalError("Analytics Revenue API", error);
  }
}
