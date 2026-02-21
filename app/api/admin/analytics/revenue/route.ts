import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, isAuthError, internalError } from '@/lib/admin-auth';
import type { RevenueData, CourseRevenue, BundleRevenue } from '@/types/analytics';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminRequest(request);
    if (isAuthError(auth)) return auth;

    const { serviceSupabase } = auth;

    const [enrollmentsResult, bundleEnrollmentsResult, coursesResult] = await Promise.all([
      serviceSupabase
        .from('enrollment_requests')
        .select('id, course_id, courses(id, title, course_type, price)')
        .eq('status', 'approved'),

      serviceSupabase
        .from('bundle_enrollment_requests')
        .select('id, bundle_id, course_bundles(id, title, price)')
        .eq('status', 'approved'),

      serviceSupabase
        .from('courses')
        .select('id, title, course_type, price'),
    ]);

    const enrollments = enrollmentsResult.data || [];
    const bundleEnrollments = bundleEnrollmentsResult.data || [];
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

    // Count enrollments and revenue per course
    for (const er of enrollments) {
      const courseId = er.course_id;
      const price = Number((er as Record<string, any>).courses?.price || 0);
      const existing = courseRevenueMap.get(courseId);
      if (existing) {
        existing.enrollmentCount += 1;
        existing.totalRevenue += price;
      }
    }

    // Aggregate bundle revenue
    const bundleRevenueMap = new Map<string, BundleRevenue>();
    for (const ber of bundleEnrollments) {
      const bundleId = ber.bundle_id;
      const bundle = (ber as Record<string, any>).course_bundles;
      const price = Number(bundle?.price || 0);
      const existing = bundleRevenueMap.get(bundleId);
      if (existing) {
        existing.enrollmentCount += 1;
        existing.totalRevenue += price;
      } else {
        bundleRevenueMap.set(bundleId, {
          bundleId,
          bundleTitle: bundle?.title || 'Unknown Bundle',
          price,
          enrollmentCount: 1,
          totalRevenue: price,
        });
      }
    }

    const courses = Array.from(courseRevenueMap.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    const totalRevenue = courses.reduce((sum, c) => sum + c.totalRevenue, 0);
    const totalBundleRevenue = Array.from(bundleRevenueMap.values())
      .reduce((sum, b) => sum + b.totalRevenue, 0);

    const data: RevenueData = {
      courses,
      totalRevenue,
      totalBundleRevenue,
      bundleRevenue: Array.from(bundleRevenueMap.values())
        .sort((a, b) => b.totalRevenue - a.totalRevenue),
    };

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
  } catch (error) {
    return internalError('Analytics Revenue API', error);
  }
}
