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

    // Try RPC function first (bypasses RLS)
    let requests: any[] = [];
    let requestsError: any = null;

    try {
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_enrollment_requests_admin', { 
          filter_status: filterStatus
        });
      
      if (rpcError) {
        console.error('[Admin API] RPC error:', rpcError);
        
        // If function doesn't exist, fallback to direct query
        if (rpcError.code === '42883' || rpcError.message?.includes('does not exist')) {
          console.log('[Admin API] RPC function not found, using direct query fallback');
          
          let query = supabase
            .from('enrollment_requests')
            .select('id, user_id, course_id, status, created_at, updated_at, reviewed_by, reviewed_at, payment_screenshots')
            .order('created_at', { ascending: false });

          if (filterStatus) {
            query = query.eq('status', filterStatus);
          }

          const result = await query;
          requests = result.data || [];
          requestsError = result.error;
        } else {
          requestsError = rpcError;
        }
      } else {
        requests = rpcData || [];
        console.log('[Admin API] RPC succeeded, found', requests.length, 'requests');
      }
    } catch (rpcErr: any) {
      console.error('[Admin API] Exception calling RPC:', rpcErr);
      requestsError = rpcErr;
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

    // Fetch profiles and courses
    let profiles: any[] = [];
    let courses: any[] = [];
    
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
      if (courseIds.length > 0) {
        const { data: coursesData, error: coursesError } = await supabase
          .from('courses')
          .select('id, title, thumbnail_url')
          .in('id', courseIds);

        if (!coursesError && coursesData) {
          courses = coursesData;
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
