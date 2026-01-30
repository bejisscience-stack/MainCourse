import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, createServerSupabaseClient, verifyTokenAndGetUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Debug endpoint to check raw database counts and sample data
export async function GET(request: NextRequest) {
  console.log('[Debug API] ========== DEBUG REQUEST STARTED ==========');

  const debugInfo: any = {
    timestamp: new Date().toISOString(),
    serviceRoleKeyPresent: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    serviceRoleKeyLength: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
    tables: {},
    errors: [],
    comparison: {},
  };

  console.log('[Debug API] Service role key present:', debugInfo.serviceRoleKeyPresent);
  console.log('[Debug API] Service role key length:', debugInfo.serviceRoleKeyLength);

  try {
    // Verify auth
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[Debug API] No auth header');
      return NextResponse.json({ error: 'Unauthorized', debugInfo }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { user, error: userError } = await verifyTokenAndGetUser(token);

    if (userError || !user) {
      console.log('[Debug API] User verification failed:', userError?.message);
      debugInfo.errors.push({ type: 'auth', message: userError?.message || 'No user' });
      return NextResponse.json({ error: 'Unauthorized', debugInfo }, { status: 401 });
    }

    debugInfo.userId = user.id;
    console.log('[Debug API] User ID:', user.id);

    // Create both clients for comparison
    const serviceSupabase = createServiceRoleClient();
    const userSupabase = createServerSupabaseClient(token);

    // Check admin status with service role
    const { data: isAdmin, error: adminError } = await serviceSupabase
      .rpc('check_is_admin', { user_id: user.id });

    debugInfo.isAdmin = isAdmin;
    console.log('[Debug API] Is admin:', isAdmin);
    if (adminError) {
      console.log('[Debug API] Admin check error:', adminError.message);
      debugInfo.errors.push({ type: 'adminCheck', message: adminError.message });
    }

    // Also get profile directly to verify role
    const { data: profileData, error: profileError } = await serviceSupabase
      .from('profiles')
      .select('id, role, username, email')
      .eq('id', user.id)
      .single();

    debugInfo.profile = profileData;
    console.log('[Debug API] User profile:', profileData);
    if (profileError) {
      console.log('[Debug API] Profile fetch error:', profileError.message);
      debugInfo.errors.push({ type: 'profileFetch', message: profileError.message });
    }

    // Query enrollment_requests with SERVICE ROLE (bypasses RLS)
    console.log('[Debug API] Querying enrollment_requests with SERVICE ROLE...');
    const { data: enrollmentData, error: enrollmentError, count: enrollmentCount } = await serviceSupabase
      .from('enrollment_requests')
      .select('*', { count: 'exact' });

    // Also query with USER token (subject to RLS) for comparison
    console.log('[Debug API] Querying enrollment_requests with USER TOKEN...');
    const { data: userEnrollmentData, error: userEnrollmentError } = await userSupabase
      .from('enrollment_requests')
      .select('*');

    debugInfo.comparison.enrollment_requests = {
      serviceRoleCount: enrollmentData?.length ?? 0,
      userTokenCount: userEnrollmentData?.length ?? 0,
      serviceRoleError: enrollmentError?.message || null,
      userTokenError: userEnrollmentError?.message || null,
    };
    console.log('[Debug API] Comparison - Service role vs User token:', debugInfo.comparison.enrollment_requests);

    debugInfo.tables.enrollment_requests = {
      count: enrollmentCount ?? enrollmentData?.length ?? 0,
      error: enrollmentError?.message || null,
      sample: enrollmentData?.slice(0, 5) || [],
      statusBreakdown: enrollmentData ? {
        pending: enrollmentData.filter(r => r.status === 'pending').length,
        approved: enrollmentData.filter(r => r.status === 'approved').length,
        rejected: enrollmentData.filter(r => r.status === 'rejected').length,
      } : null
    };
    console.log('[Debug API] enrollment_requests:', debugInfo.tables.enrollment_requests);

    // Query bundle_enrollment_requests
    console.log('[Debug API] Querying bundle_enrollment_requests...');
    const { data: bundleData, error: bundleError, count: bundleCount } = await serviceSupabase
      .from('bundle_enrollment_requests')
      .select('*', { count: 'exact' });

    debugInfo.tables.bundle_enrollment_requests = {
      count: bundleCount ?? bundleData?.length ?? 0,
      error: bundleError?.message || null,
      sample: bundleData?.slice(0, 5) || [],
      statusBreakdown: bundleData ? {
        pending: bundleData.filter(r => r.status === 'pending').length,
        approved: bundleData.filter(r => r.status === 'approved').length,
        rejected: bundleData.filter(r => r.status === 'rejected').length,
      } : null
    };
    console.log('[Debug API] bundle_enrollment_requests:', debugInfo.tables.bundle_enrollment_requests);

    // Query withdrawal_requests
    console.log('[Debug API] Querying withdrawal_requests...');
    const { data: withdrawalData, error: withdrawalError, count: withdrawalCount } = await serviceSupabase
      .from('withdrawal_requests')
      .select('*', { count: 'exact' });

    debugInfo.tables.withdrawal_requests = {
      count: withdrawalCount ?? withdrawalData?.length ?? 0,
      error: withdrawalError?.message || null,
      sample: withdrawalData?.slice(0, 5) || [],
      statusBreakdown: withdrawalData ? {
        pending: withdrawalData.filter(r => r.status === 'pending').length,
        approved: withdrawalData.filter(r => r.status === 'approved').length,
        rejected: withdrawalData.filter(r => r.status === 'rejected').length,
        completed: withdrawalData.filter(r => r.status === 'completed').length,
      } : null
    };
    console.log('[Debug API] withdrawal_requests:', debugInfo.tables.withdrawal_requests);

    // Also query profiles to check if user profiles exist
    if (enrollmentData && enrollmentData.length > 0) {
      const userIds = [...new Set(enrollmentData.map(r => r.user_id))];
      const { data: profiles, error: profilesError } = await serviceSupabase
        .from('profiles')
        .select('id, username, email')
        .in('id', userIds);

      debugInfo.relatedProfiles = {
        requestedIds: userIds,
        foundCount: profiles?.length || 0,
        error: profilesError?.message || null,
        found: profiles || []
      };
    }

    console.log('[Debug API] Full debug info:', JSON.stringify(debugInfo, null, 2));

    return NextResponse.json(debugInfo, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    });
  } catch (error: any) {
    console.error('[Debug API] Error:', error);
    debugInfo.errors.push({ type: 'exception', message: error.message, stack: error.stack });
    return NextResponse.json(debugInfo, { status: 500 });
  }
}
