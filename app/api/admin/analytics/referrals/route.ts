import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, isAuthError, internalError } from '@/lib/admin-auth';
import type { ReferralStats, ReferralByCourse, TopReferrer } from '@/types/analytics';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminRequest(request);
    if (isAuthError(auth)) return auth;

    const { serviceSupabase } = auth;

    const [referralsResult, commissionsResult] = await Promise.all([
      serviceSupabase
        .from('referrals')
        .select('id, referrer_id, referred_user_id, referral_code, course_id, created_at, courses(id, title)'),

      serviceSupabase
        .from('balance_transactions')
        .select('user_id, amount')
        .eq('source', 'referral_commission'),
    ]);

    const referrals = referralsResult.data || [];
    const commissions = commissionsResult.data || [];

    // Aggregate referrals by course
    const byCourseMap = new Map<string, ReferralByCourse>();
    for (const ref of referrals) {
      const courseId = ref.course_id;
      const existing = byCourseMap.get(courseId);
      if (existing) {
        existing.count += 1;
      } else {
        byCourseMap.set(courseId, {
          courseId,
          courseTitle: (ref as Record<string, any>).courses?.title || 'Unknown Course',
          count: 1,
        });
      }
    }

    // Aggregate commission per referrer
    const commissionMap = new Map<string, number>();
    for (const tx of commissions) {
      const current = commissionMap.get(tx.user_id) || 0;
      commissionMap.set(tx.user_id, current + Number(tx.amount));
    }

    // Aggregate referrals by referrer
    const referrerMap = new Map<string, { count: number; referralCode: string }>();
    for (const ref of referrals) {
      const existing = referrerMap.get(ref.referrer_id);
      if (existing) {
        existing.count += 1;
      } else {
        referrerMap.set(ref.referrer_id, {
          count: 1,
          referralCode: ref.referral_code,
        });
      }
    }

    // Fetch profiles for top referrers
    const referrerIds = Array.from(referrerMap.keys());
    let profiles: Array<{ id: string; username: string; email: string }> = [];
    if (referrerIds.length > 0) {
      const { data: profilesData } = await serviceSupabase
        .from('profiles')
        .select('id, username, email')
        .in('id', referrerIds);
      profiles = profilesData || [];
    }

    const profilesMap = new Map(profiles.map(p => [p.id, p]));

    const topReferrers: TopReferrer[] = Array.from(referrerMap.entries())
      .map(([userId, data]) => {
        const profile = profilesMap.get(userId);
        return {
          userId,
          username: profile?.username || 'Unknown',
          email: profile?.email || '',
          referralCode: data.referralCode,
          activationCount: data.count,
          totalCommission: commissionMap.get(userId) || 0,
        };
      })
      .sort((a, b) => b.activationCount - a.activationCount)
      .slice(0, 20);

    const stats: ReferralStats = {
      totalActivations: referrals.length,
      referralsByCourse: Array.from(byCourseMap.values())
        .sort((a, b) => b.count - a.count),
      topReferrers,
    };

    return NextResponse.json(stats, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
  } catch (error) {
    return internalError('Analytics Referrals API', error);
  }
}
