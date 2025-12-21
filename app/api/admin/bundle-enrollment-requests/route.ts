import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyTokenAndGetUser } from '@/lib/supabase-server';

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

    console.log('[Admin API] Fetching bundle requests, filter:', filterStatus || 'all');

    // Fetch bundle enrollment requests
    let query = supabase
      .from('bundle_enrollment_requests')
      .select('id, user_id, bundle_id, status, created_at, updated_at, reviewed_by, reviewed_at, payment_screenshots')
      .order('created_at', { ascending: false });

    if (filterStatus) {
      query = query.eq('status', filterStatus);
    }

    const { data: requests, error: requestsError } = await query;

    if (requestsError) {
      console.error('[Admin API] Failed to fetch bundle requests:', requestsError);
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
    if (!requests || requests.length === 0) {
      console.log('[Admin API] No bundle requests found');
      return NextResponse.json({ requests: [] });
    }

    console.log('[Admin API] Processing', requests.length, 'bundle requests');

    // Get unique user IDs and bundle IDs
    const userIds = [...new Set(requests.map(r => r.user_id).filter(Boolean))];
    const bundleIds = [...new Set(requests.map(r => r.bundle_id).filter(Boolean))];

    // Fetch profiles and bundles
    let profiles: any[] = [];
    let bundles: any[] = [];
    
    try {
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, email')
          .in('id', userIds);

        if (!profilesError && profilesData) {
          profiles = profilesData;
        }
      }
    } catch (err) {
      console.error('[Admin API] Error fetching profiles:', err);
    }

    try {
      if (bundleIds.length > 0) {
        const { data: bundlesData, error: bundlesError } = await supabase
          .from('course_bundles')
          .select('id, title, price')
          .in('id', bundleIds);

        if (!bundlesError && bundlesData) {
          bundles = bundlesData;
        }
      }
    } catch (err) {
      console.error('[Admin API] Error fetching bundles:', err);
    }

    // Create lookup maps
    const profilesMap = new Map(profiles.map(p => [p.id, p]));
    const bundlesMap = new Map(bundles.map(b => [b.id, b]));

    // Combine the data
    const requestsWithRelations = requests.map(request => ({
      ...request,
      profiles: profilesMap.get(request.user_id) || null,
      bundles: bundlesMap.get(request.bundle_id) || null,
    }));

    console.log('[Admin API] Returning', requestsWithRelations.length, 'bundle requests with relations');

    return NextResponse.json({ 
      requests: requestsWithRelations
    });
  } catch (error: any) {
    console.error('[Admin API] Unhandled exception:', error);
    console.error('[Admin API] Error stack:', error.stack);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message || 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}

