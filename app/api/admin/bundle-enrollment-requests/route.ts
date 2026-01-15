import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient, verifyTokenAndGetUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Helper function to check if user is admin using RPC function (bypasses RLS)
async function checkAdmin(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .rpc('check_is_admin', { user_id: userId });

    if (error) {
      console.error('[Admin API] Error checking admin status:', error);
      return false;
    }

    return data === true;
  } catch (err) {
    console.error('[Admin API] Exception checking admin:', err);
    return false;
  }
}

// GET: Fetch all bundle enrollment requests (admin only)
export async function GET(request: NextRequest) {
  console.log(`[Admin Bundle API] Request started at ${new Date().toISOString()}`);
  const hasServiceRoleKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log(`[Admin Bundle API] Service role key present: ${hasServiceRoleKey}`);

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { user, error: userError } = await verifyTokenAndGetUser(token);
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', details: userError?.message },
        { status: 401 }
      );
    }

    const supabase = createServerSupabaseClient(token);

    // Check if user is admin
    const isAdmin = await checkAdmin(supabase, user.id);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Get query params for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'pending', 'approved', 'rejected', or null for all

    // Ensure we pass null instead of empty string for "all" requests
    const filterStatus = status && status !== 'all' && status.trim() !== '' ? status : null;

    console.log('[Admin Bundle API] Fetching bundle requests, filter:', filterStatus || 'all');

    // Fetch bundle enrollment requests using SECURITY DEFINER RPC function (guarantees RLS bypass)
    let requests: any[] = [];
    let requestsError: any = null;

    try {
      // Use RPC function that runs with SECURITY DEFINER to bypass RLS
      // This is more reliable than service role client for ensuring all records are returned
      const { data, error } = await supabase
        .rpc('get_bundle_enrollment_requests_admin', { filter_status: filterStatus });

      requests = data || [];
      requestsError = error;

      // Log raw data from database to verify we're getting fresh data
      if (requests.length > 0) {
        console.log('[Admin Bundle API] Raw bundle DB data (first 3):', requests.slice(0, 3).map((r: any) => ({
          id: r.id.substring(0, 8) + '...',
          status: r.status,
          updated_at: r.updated_at,
          reviewed_at: r.reviewed_at
        })));
      }

      if (requestsError) {
        console.error('[Admin Bundle API] RPC query error:', requestsError);
        // Check if function doesn't exist yet (migrations not run)
        if (requestsError.code === '42883' || requestsError.message?.includes('does not exist')) {
          console.warn('[Admin Bundle API] RPC function not found, falling back to direct query');
          // Fallback to direct query (for backward compatibility during migration)
          const serviceSupabase = hasServiceRoleKey
            ? createServiceRoleClient()
            : createServerSupabaseClient(token);

          const queryBuilder = serviceSupabase
            .from('bundle_enrollment_requests')
            .select('id, user_id, bundle_id, status, created_at, updated_at, reviewed_by, reviewed_at, payment_screenshots')
            .order('created_at', { ascending: false });

          const finalQuery = filterStatus
            ? queryBuilder.eq('status', filterStatus)
            : queryBuilder;

          const result = await finalQuery;
          requests = result.data || [];
          requestsError = result.error;

          if (!requestsError) {
            console.log('[Admin Bundle API] Fallback query succeeded, found', requests.length, 'requests');
          }
        }
      } else {
        console.log('[Admin Bundle API] RPC query succeeded, found', requests.length, 'requests');
      }
    } catch (err: any) {
      console.error('[Admin Bundle API] RPC query failed:', err);
      requestsError = err;
    }

    // If we have an error and no requests, return error
    if (requestsError && requests.length === 0) {
      console.error('[Admin Bundle API] Failed to fetch bundle requests:', requestsError);
      return NextResponse.json(
        { 
          error: 'Failed to fetch bundle enrollment requests',
          details: requestsError.message || 'Database query failed',
          code: requestsError.code
        },
        { status: 500 }
      );
    }

    // If no requests, return empty array
    if (requests.length === 0) {
      console.log('[Admin Bundle API] No bundle requests found');
      return NextResponse.json({ requests: [] });
    }

    console.log('[Admin Bundle API] Processing', requests.length, 'bundle requests');

    // Get unique user IDs and bundle IDs
    const userIds = [...new Set(requests.map(r => r.user_id).filter(Boolean))];
    const bundleIds = [...new Set(requests.map(r => r.bundle_id).filter(Boolean))];

    // Fetch profiles and bundles
    let profiles: any[] = [];
    let bundles: any[] = [];
    
    try {
      if (userIds.length > 0) {
        // Use service role client for profiles too to ensure consistency
        const serviceSupabase = hasServiceRoleKey
          ? createServiceRoleClient()
          : createServerSupabaseClient(token);
        const { data: profilesData, error: profilesError } = await serviceSupabase
          .from('profiles')
          .select('id, username, email')
          .in('id', userIds);

        if (!profilesError && profilesData) {
          profiles = profilesData;
        }
      }
    } catch (err) {
      console.error('[Admin Bundle API] Error fetching profiles:', err);
    }

    try {
      if (bundleIds.length > 0) {
        // Use service role client for bundles too to ensure consistency
        const serviceSupabase = hasServiceRoleKey
          ? createServiceRoleClient()
          : createServerSupabaseClient(token);
        const { data: bundlesData, error: bundlesError } = await serviceSupabase
          .from('course_bundles')
          .select('id, title, price')
          .in('id', bundleIds);

        if (!bundlesError && bundlesData) {
          bundles = bundlesData;
        }
      }
    } catch (err) {
      console.error('[Admin Bundle API] Error fetching bundles:', err);
    }

    // Create lookup maps
    const profilesMap = new Map(profiles.map(p => [p.id, p]));
    const bundlesMap = new Map(bundles.map(b => [b.id, b]));

    // Combine the data and parse payment_screenshots if it's a JSON string
    const requestsWithRelations = requests.map(request => {
      // Parse payment_screenshots if it's a string (JSON)
      let paymentScreenshots = request.payment_screenshots;
      if (typeof paymentScreenshots === 'string') {
        try {
          paymentScreenshots = JSON.parse(paymentScreenshots);
        } catch (e) {
          console.warn('[Admin Bundle API] Failed to parse payment_screenshots for request', request.id, e);
          paymentScreenshots = [];
        }
      }
      
      return {
        ...request,
        payment_screenshots: paymentScreenshots,
        profiles: profilesMap.get(request.user_id) || null,
        bundles: bundlesMap.get(request.bundle_id) || null,
      };
    });

    console.log('[Admin Bundle API] Returning', requestsWithRelations.length, 'bundle requests with relations');
    console.log('[Admin Bundle API] Final bundle statuses being returned:', requestsWithRelations.map(r => ({ id: r.id, status: r.status, updated_at: r.updated_at })));

    // Return with no-cache headers to prevent stale data
    return NextResponse.json({ 
      requests: requestsWithRelations
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error: any) {
    console.error('[Admin Bundle API] Unhandled exception:', error);
    console.error('[Admin Bundle API] Error stack:', error.stack);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message || 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}


