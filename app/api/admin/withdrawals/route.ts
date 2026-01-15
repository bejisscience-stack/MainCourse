import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient, verifyTokenAndGetUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Helper function to check if user is admin using RPC function (bypasses RLS)
async function checkAdmin(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .rpc('check_is_admin', { user_id: userId });

    if (error) {
      console.error('[Admin Withdrawals API] Error checking admin status:', error);
      return false;
    }

    return data === true;
  } catch (err) {
    console.error('[Admin Withdrawals API] Exception checking admin:', err);
    return false;
  }
}

// GET: Fetch all withdrawal requests (admin only)
export async function GET(request: NextRequest) {
  console.log(`[Admin Withdrawals API] Request started at ${new Date().toISOString()}`);
  const hasServiceRoleKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log(`[Admin Withdrawals API] Service role key present: ${hasServiceRoleKey}`);

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

    // Check if user is admin using RPC (bypasses RLS)
    const isAdmin = await checkAdmin(supabase, user.id);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Access denied. Admin only.' },
        { status: 403 }
      );
    }

    // Parse status filter from query params
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const filterStatus = statusFilter && statusFilter !== 'all' && statusFilter.trim() !== '' ? statusFilter : null;

    console.log('[Admin Withdrawals API] Fetching requests, filter:', filterStatus || 'all');

    // Fetch withdrawal requests using SECURITY DEFINER RPC function (guarantees RLS bypass)
    let requests: any[] = [];
    let requestsError: any = null;

    try {
      // Use RPC function that runs with SECURITY DEFINER to bypass RLS
      // This is more reliable than service role client for ensuring all records are returned
      const { data, error } = await supabase
        .rpc('get_withdrawal_requests_admin', { filter_status: filterStatus });

      requests = data || [];
      requestsError = error;

      if (requestsError) {
        console.error('[Admin Withdrawals API] RPC query error:', requestsError);
        // Check if function doesn't exist yet (migrations not run)
        if (requestsError.code === '42883' || requestsError.message?.includes('does not exist')) {
          return NextResponse.json({ requests: [], message: 'Withdrawal system not yet configured' });
        }
      } else {
        console.log('[Admin Withdrawals API] RPC query succeeded, found', requests.length, 'requests');
      }
    } catch (err: any) {
      console.error('[Admin Withdrawals API] RPC query failed:', err);
      requestsError = err;
    }

    // If we have an error and no requests, return error
    if (requestsError && requests.length === 0) {
      console.error('[Admin Withdrawals API] Failed to fetch requests:', requestsError);
      return NextResponse.json(
        { 
          error: 'Failed to fetch withdrawal requests',
          details: requestsError.message || 'Database query failed',
          code: requestsError.code
        },
        { status: 500 }
      );
    }

    // If no requests, return empty array
    if (requests.length === 0) {
      console.log('[Admin Withdrawals API] No requests found');
      return NextResponse.json({ requests: [] });
    }

    console.log('[Admin Withdrawals API] Processing', requests.length, 'requests');

    // Get unique user IDs
    const userIds = [...new Set(requests.map(r => r.user_id).filter(Boolean))];

    // Fetch profiles using service role to avoid RLS
    let profiles: any[] = [];
    
    try {
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await (hasServiceRoleKey ? createServiceRoleClient() : createServerSupabaseClient(token))
          .from('profiles')
          .select('id, username, email, role, balance')
          .in('id', userIds);

        if (!profilesError && profilesData) {
          profiles = profilesData;
        } else if (profilesError) {
          console.error('[Admin Withdrawals API] Service role profiles error:', profilesError);
        }
      }
    } catch (err) {
      console.error('[Admin Withdrawals API] Error fetching profiles:', err);
    }

    // Create lookup map
    const profilesMap = new Map(profiles.map(p => [p.id, p]));

    // Combine the data
    const requestsWithRelations = requests.map(request => ({
      ...request,
      profiles: profilesMap.get(request.user_id) || null,
    }));

    console.log('[Admin Withdrawals API] Returning', requestsWithRelations.length, 'requests with relations');

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
    console.error('[Admin Withdrawals API] Unhandled exception:', error);
    console.error('[Admin Withdrawals API] Error stack:', error.stack);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message || 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}

