import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, isAuthError, internalError } from '@/lib/admin-auth';
import type { AnalyticsOverview } from '@/types/analytics';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminRequest(request);
    if (isAuthError(auth)) return auth;

    const { serviceSupabase } = auth;

    // Run all queries in parallel
    const [
      waitingListResult,
      enrollmentsResult,
      referralsResult,
      projectsResult,
      bundleEnrollmentsResult,
    ] = await Promise.all([
      serviceSupabase
        .from('coming_soon_emails')
        .select('*', { count: 'exact', head: true }),

      serviceSupabase
        .from('enrollment_requests')
        .select('id, course_id, courses(price)')
        .eq('status', 'approved'),

      serviceSupabase
        .from('referrals')
        .select('*', { count: 'exact', head: true }),

      serviceSupabase
        .from('projects')
        .select('id, budget'),

      serviceSupabase
        .from('bundle_enrollment_requests')
        .select('id, bundle_id, course_bundles(price)')
        .eq('status', 'approved'),
    ]);

    const enrollments = enrollmentsResult.data || [];
    const totalRevenue = enrollments.reduce((sum: number, er: Record<string, any>) => {
      return sum + Number(er.courses?.price || 0);
    }, 0);

    const bundleEnrollments = bundleEnrollmentsResult.data || [];
    const totalBundleRevenue = bundleEnrollments.reduce((sum: number, ber: Record<string, any>) => {
      return sum + Number(ber.course_bundles?.price || 0);
    }, 0);

    const projects = projectsResult.data || [];
    const totalProjectBudget = projects.reduce((sum: number, p: Record<string, any>) => {
      return sum + Number(p.budget || 0);
    }, 0);

    const overview: AnalyticsOverview = {
      waitingListCount: waitingListResult.count || 0,
      totalRevenue,
      totalEnrollments: enrollments.length,
      totalReferrals: referralsResult.count || 0,
      totalProjects: projects.length,
      totalProjectBudget,
      totalBundleRevenue,
      totalBundleEnrollments: bundleEnrollments.length,
    };

    return NextResponse.json(overview, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
  } catch (error) {
    return internalError('Analytics Overview API', error);
  }
}
