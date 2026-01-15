import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient, verifyTokenAndGetUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Generate a simple request ID for tracking
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// Retry with exponential backoff for server-side operations
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 500,
  requestId: string = ''
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      console.error(`[Admin API ${requestId}] Attempt ${attempt + 1}/${maxRetries} failed:`, error.message);

      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('All retry attempts failed');
}

// Helper function to check if user is admin using RPC function (bypasses RLS)
async function checkAdmin(supabase: any, userId: string, requestId: string = ''): Promise<boolean> {
  try {
    const result = await retryWithBackoff(async () => {
      const { data, error } = await supabase
        .rpc('check_is_admin', { user_id: userId });

      if (error) {
        throw error;
      }

      return data;
    }, 3, 500, requestId);

    return result === true;
  } catch (err) {
    console.error(`[Admin API ${requestId}] Exception checking admin after retries:`, err);
    return false;
  }
}

// GET: Fetch all enrollment requests (admin only)
export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  console.log(`[Admin API ${requestId}] Request started at ${new Date().toISOString()}`);
  const hasServiceRoleKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log(`[Admin API ${requestId}] Service role key present: ${hasServiceRoleKey}`);

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`[Admin API ${requestId}] Missing or invalid authorization header`);
      return NextResponse.json(
        { error: 'Unauthorized', requestId },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { user, error: userError } = await verifyTokenAndGetUser(token);

    if (userError || !user) {
      console.log(`[Admin API ${requestId}] Token verification failed:`, userError?.message);
      return NextResponse.json(
        { error: 'Unauthorized', details: userError?.message, requestId },
        { status: 401 }
      );
    }

    const supabase = createServerSupabaseClient(token);

    // Check if user is admin with retry
    const isAdmin = await checkAdmin(supabase, user.id, requestId);
    if (!isAdmin) {
      console.log(`[Admin API ${requestId}] User ${user.id} is not admin`);
      return NextResponse.json(
        { error: 'Forbidden: Admin access required', requestId },
        { status: 403 }
      );
    }

    // Get query params for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'pending', 'approved', 'rejected', or null for all

    // Ensure we pass null instead of empty string for "all" requests
    const filterStatus = status && status !== 'all' && status.trim() !== '' ? status : null;

    console.log(`[Admin API ${requestId}] Fetching requests, filter:`, filterStatus || 'all');

    // Fetch enrollment requests using SECURITY DEFINER RPC function (guarantees RLS bypass)
    let requests: any[] = [];
    let requestsError: any = null;

    try {
      // Use RPC function that runs with SECURITY DEFINER to bypass RLS
      // This is more reliable than service role client for ensuring all records are returned
      const { data, error } = await supabase
        .rpc('get_enrollment_requests_admin', { filter_status: filterStatus });

      requests = data || [];
      requestsError = error;

      // Log raw data from database to verify we're getting fresh data
      if (requests.length > 0) {
        console.log('[Admin API] Raw DB data (first 3):', requests.slice(0, 3).map((r: any) => ({
          id: r.id.substring(0, 8) + '...',
          status: r.status,
          updated_at: r.updated_at,
          reviewed_at: r.reviewed_at
        })));
      }

      if (requestsError) {
        console.error('[Admin API] RPC query error:', requestsError);
      } else {
        console.log('[Admin API] RPC query succeeded, found', requests.length, 'requests');
        // Log the actual statuses returned to debug stale data issues
        console.log('[Admin API] Request statuses from DB:', requests.map((r: any) => ({ id: r.id, status: r.status, updated_at: r.updated_at })));
      }
    } catch (err: any) {
      console.error('[Admin API] RPC query failed:', err);
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
        const { data: profilesData, error: profilesError } = await (hasServiceRoleKey ? createServiceRoleClient() : createServerSupabaseClient(token))
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
        const { data: coursesData, error: coursesError } = await (hasServiceRoleKey ? createServiceRoleClient() : createServerSupabaseClient(token))
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

    // Fetch referrer profiles for requests that have referral codes
    const referralCodes = [...new Set(requests.map(r => r.referral_code).filter(Boolean))];
    let referrerProfiles: any[] = [];

    try {
      if (referralCodes.length > 0) {
        const { data: referrerData, error: referrerError } = await (hasServiceRoleKey ? createServiceRoleClient() : createServerSupabaseClient(token))
          .from('profiles')
          .select('id, username, email, referral_code')
          .in('referral_code', referralCodes);

        if (!referrerError && referrerData) {
          referrerProfiles = referrerData;
        } else if (referrerError) {
          console.error('[Admin API] Service role referrer profiles error:', referrerError);
        }
      }
    } catch (err) {
      console.error('[Admin API] Error fetching referrer profiles:', err);
    }

    // Create lookup maps
    const profilesMap = new Map(profiles.map(p => [p.id, p]));
    const coursesMap = new Map(courses.map(c => [c.id, c]));
    const referrerMap = new Map(referrerProfiles.map(p => [p.referral_code, p]));

    // Combine the data
    const requestsWithRelations = requests.map(request => ({
      ...request,
      profiles: profilesMap.get(request.user_id) || null,
      courses: coursesMap.get(request.course_id) || null,
      referrer: request.referral_code ? referrerMap.get(request.referral_code) || null : null,
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
    const duration = Date.now() - startTime;
    console.error(`[Admin API ${requestId}] Unhandled exception after ${duration}ms:`, error);
    console.error(`[Admin API ${requestId}] Error stack:`, error.stack);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message || 'An unexpected error occurred',
        requestId,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
