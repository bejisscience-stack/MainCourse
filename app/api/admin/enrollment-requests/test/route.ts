import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyTokenAndGetUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Test endpoint to debug enrollment requests
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { user, error: userError } = await verifyTokenAndGetUser(token);
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerSupabaseClient(token);

    // Check admin status
    const { data: isAdmin } = await supabase.rpc('check_is_admin', { user_id: user.id });
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Test 1: Direct query (may be limited by RLS)
    const { data: directData, error: directError } = await supabase
      .from('enrollment_requests')
      .select('id, user_id, course_id, status, created_at')
      .order('created_at', { ascending: false });

    // Test 2: Get counts
    const { data: countData, error: countError } = await supabase
      .rpc('get_enrollment_requests_count')
      .catch(() => ({ data: null, error: { message: 'Count function not available' } }));

    // Test 3: RPC function with pending filter
    const { data: rpcPendingData, error: rpcPendingError } = await supabase
      .rpc('get_enrollment_requests_admin', { filter_status: 'pending' });

    // Test 4: RPC function with null (all)
    const { data: rpcAllData, error: rpcAllError } = await supabase
      .rpc('get_enrollment_requests_admin', { filter_status: null });

    // Test 5: RPC function with empty string
    const { data: rpcEmptyData, error: rpcEmptyError } = await supabase
      .rpc('get_enrollment_requests_admin', { filter_status: '' });

    return NextResponse.json({
      counts: {
        data: countData,
        error: countError?.message
      },
      directQuery: {
        count: directData?.length || 0,
        data: directData?.map(r => ({ id: r.id, course_id: r.course_id, status: r.status, created_at: r.created_at })),
        error: directError?.message
      },
      rpcPending: {
        count: rpcPendingData?.length || 0,
        data: rpcPendingData?.map(r => ({ id: r.id, course_id: r.course_id, status: r.status })),
        error: rpcPendingError?.message
      },
      rpcAll: {
        count: rpcAllData?.length || 0,
        data: rpcAllData?.map(r => ({ id: r.id, course_id: r.course_id, status: r.status })),
        error: rpcAllError?.message
      },
      rpcEmpty: {
        count: rpcEmptyData?.length || 0,
        data: rpcEmptyData?.map(r => ({ id: r.id, course_id: r.course_id, status: r.status })),
        error: rpcEmptyError?.message
      },
      userId: user.id
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}



