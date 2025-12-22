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

// GET: Fetch all enrollment requests (admin only)
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

    console.log('[Admin API] Fetching requests, filter:', filterStatus || 'all');

    // Fetch enrollment requests using service role to bypass RLS entirely
    let requests: any[] = [];
    let requestsError: any = null;

    try {
      // Create a fresh service role client for each request to avoid any connection pooling/caching issues
      const serviceSupabase = createServiceRoleClient();

      // Query with explicit cache control and include all fields
      // Force a fresh query by ordering by updated_at (most recent first)
      // This ensures we get the latest status changes
      // Use a direct query without any intermediate variables to avoid caching
      const queryBuilder = serviceSupabase
        .from('enrollment_requests')
        .select('id, user_id, course_id, status, created_at, updated_at, reviewed_by, reviewed_at, payment_screenshots, referral_code')
        .order('updated_at', { ascending: false }); // Order by updated_at to get most recently changed first

      const finalQuery = filterStatus 
        ? queryBuilder.eq('status', filterStatus)
        : queryBuilder;

      // Execute query immediately
      const result = await finalQuery;
      requests = result.data || [];
      requestsError = result.error;
      
      // Log raw data from database to verify we're getting fresh data
      if (requests.length > 0) {
        console.log('[Admin API] Raw DB data (first 3):', requests.slice(0, 3).map(r => ({
          id: r.id.substring(0, 8) + '...',
          status: r.status,
          updated_at: r.updated_at,
          reviewed_at: r.reviewed_at
        })));
      }

      if (requestsError) {
        console.error('[Admin API] Service role query error:', requestsError);
      } else {
        console.log('[Admin API] Service role query succeeded, found', requests.length, 'requests');
        // Log the actual statuses returned to debug stale data issues
        console.log('[Admin API] Request statuses from DB:', requests.map(r => ({ id: r.id, status: r.status, updated_at: r.updated_at })));
      }
    } catch (err: any) {
      console.error('[Admin API] Service role query failed:', err);
      requestsError = err;
    }

    // If we have an error and no requests, return error
    if (requestsError && requests.length === 0) {
      console.error('[Admin API] Failed to fetch requests:', requestsError);
      return NextResponse.json(
        { 
          error: 'Failed to fetch enrollment requests',
          details: requestsError.message || 'Database query failed',
          code: requestsError.code
        },
        { status: 500 }
      );
    }

    // If no requests, return empty array
    if (requests.length === 0) {
      console.log('[Admin API] No requests found');
      return NextResponse.json({ requests: [] });
    }

    console.log('[Admin API] Processing', requests.length, 'requests');

    // Get unique user IDs and course IDs
    const userIds = [...new Set(requests.map(r => r.user_id).filter(Boolean))];
    const courseIds = [...new Set(requests.map(r => r.course_id).filter(Boolean))];

    // Fetch profiles and courses using service role to avoid RLS
    let profiles: any[] = [];
    let courses: any[] = [];
    
    try {
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await createServiceRoleClient()
          .from('profiles')
          .select('id, username, email')
          .in('id', userIds);

        if (!profilesError && profilesData) {
          profiles = profilesData;
        } else if (profilesError) {
          console.error('[Admin API] Service role profiles error:', profilesError);
        }
      }
    } catch (err) {
      console.error('[Admin API] Error fetching profiles:', err);
    }

    try {
      if (courseIds.length > 0) {
        const { data: coursesData, error: coursesError } = await createServiceRoleClient()
          .from('courses')
          .select('id, title, thumbnail_url')
          .in('id', courseIds);

        if (!coursesError && coursesData) {
          courses = coursesData;
        } else if (coursesError) {
          console.error('[Admin API] Service role courses error:', coursesError);
        }
      }
    } catch (err) {
      console.error('[Admin API] Error fetching courses:', err);
    }

    // Create lookup maps
    const profilesMap = new Map(profiles.map(p => [p.id, p]));
    const coursesMap = new Map(courses.map(c => [c.id, c]));

    // Combine the data
    const requestsWithRelations = requests.map(request => ({
      ...request,
      profiles: profilesMap.get(request.user_id) || null,
      courses: coursesMap.get(request.course_id) || null,
    }));

    console.log('[Admin API] Returning', requestsWithRelations.length, 'requests with relations');
    console.log('[Admin API] Final statuses being returned:', requestsWithRelations.map(r => ({ id: r.id, status: r.status, updated_at: r.updated_at })));

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
