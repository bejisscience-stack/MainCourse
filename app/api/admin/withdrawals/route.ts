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

    // Use RPC function to bypass RLS and get ALL withdrawal requests
    // RPC functions are marked VOLATILE to prevent caching
    let requests: any[] = [];
    let requestsError: any = null;

    try {
      console.log('[Admin Withdrawals API] Using RPC function get_withdrawal_requests_admin');
      const serviceSupabase = createServiceRoleClient(token);

      // Use RPC function which is marked VOLATILE to prevent caching
      const { data: rpcData, error: rpcError } = await serviceSupabase
        .rpc('get_withdrawal_requests_admin', {
          filter_status: filterStatus || null
        });

      if (rpcError) {
        console.error('[Admin Withdrawals API] RPC error:', rpcError);
        // Fallback to direct query if RPC fails
        console.log('[Admin Withdrawals API] Falling back to direct query');
        let queryBuilder = serviceSupabase
          .from('withdrawal_requests')
          .select('id, user_id, user_type, amount, bank_account_number, status, admin_notes, processed_at, processed_by, created_at, updated_at')
          .order('created_at', { ascending: false });

        if (filterStatus) {
          queryBuilder = queryBuilder.eq('status', filterStatus);
        }

        const { data, error } = await queryBuilder;
        requests = data || [];
        requestsError = error;
      } else {
        requests = rpcData || [];
        console.log('[Admin Withdrawals API] RPC succeeded, found', requests.length, 'requests');
      }

      // Verify count matches
      const { count: dbCount, error: dbCountError } = await serviceSupabase
        .from('withdrawal_requests')
        .select('*', { count: 'exact', head: true });

      if (!dbCountError && dbCount !== null) {
        console.log(`[Admin Withdrawals API] DB total count: ${dbCount}, Query returned: ${requests.length}`);
        if (dbCount !== requests.length && !filterStatus) {
          console.warn(`[Admin Withdrawals API] WARNING: Count mismatch! DB has ${dbCount} records but query returned ${requests.length}`);
        }
      }

      console.log('[Admin Withdrawals API] Request statuses:', requests.map((r: any) => ({ id: r.id, status: r.status })));
    } catch (err: any) {
      console.error('[Admin Withdrawals API] Query failed:', err);
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
        const { data: profilesData, error: profilesError } = await createServiceRoleClient(token)
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

