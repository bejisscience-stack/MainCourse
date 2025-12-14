import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyTokenAndGetUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Helper function to check if user is admin using RPC function (bypasses RLS)
async function checkAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .rpc('check_is_admin', { user_id: userId });

  if (error) {
    console.error('Error checking admin status:', error);
    return false;
  }

  return data === true;
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

    // Fetch enrollment requests first (without joins to avoid RLS issues)
    let query = supabase
      .from('enrollment_requests')
      .select('id, user_id, course_id, status, created_at, updated_at, reviewed_by, reviewed_at, payment_screenshots')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: requests, error: requestsError } = await query;

    if (requestsError) {
      console.error('Error fetching enrollment requests:', requestsError);
      console.error('Error details:', {
        code: requestsError.code,
        message: requestsError.message,
        details: requestsError.details,
        hint: requestsError.hint,
      });
      
      return NextResponse.json(
        { 
          error: 'Failed to fetch enrollment requests',
          details: requestsError.message || 'Database query failed',
          code: requestsError.code
        },
        { status: 500 }
      );
    }

    if (!requests || requests.length === 0) {
      return NextResponse.json({ requests: [] });
    }

    // Get unique user IDs and course IDs
    const userIds = [...new Set(requests.map(r => r.user_id).filter(Boolean))];
    const courseIds = [...new Set(requests.map(r => r.course_id).filter(Boolean))];

    // Fetch profiles for all users (admin can view all profiles)
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, email')
      .in('id', userIds);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      // Continue without profiles rather than failing completely
    }

    // Fetch courses
    const { data: courses, error: coursesError } = await supabase
      .from('courses')
      .select('id, title, thumbnail_url')
      .in('id', courseIds);

    if (coursesError) {
      console.error('Error fetching courses:', coursesError);
      // Continue without courses rather than failing completely
    }

    // Create lookup maps
    const profilesMap = new Map((profiles || []).map(p => [p.id, p]));
    const coursesMap = new Map((courses || []).map(c => [c.id, c]));

    // Combine the data
    const requestsWithRelations = requests.map(request => ({
      ...request,
      profiles: profilesMap.get(request.user_id) || null,
      courses: coursesMap.get(request.course_id) || null,
    }));

    return NextResponse.json({ requests: requestsWithRelations });
  } catch (error: any) {
    console.error('Error in GET /api/admin/enrollment-requests:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message || 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}

