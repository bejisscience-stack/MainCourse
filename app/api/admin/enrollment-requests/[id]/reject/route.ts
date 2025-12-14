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

// POST: Reject an enrollment request (admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params;

    // Get the enrollment request
    const { data: enrollmentRequest, error: fetchError } = await supabase
      .from('enrollment_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !enrollmentRequest) {
      return NextResponse.json(
        { error: 'Enrollment request not found' },
        { status: 404 }
      );
    }

    if (enrollmentRequest.status !== 'pending') {
      return NextResponse.json(
        { error: `Enrollment request is already ${enrollmentRequest.status}` },
        { status: 400 }
      );
    }

    // Use the database function to reject (ensures consistency)
    const { error: rejectError } = await supabase.rpc('reject_enrollment_request', {
      request_id: id,
    });

    if (rejectError) {
      console.error('Error rejecting enrollment request:', rejectError);
      return NextResponse.json(
        { error: 'Failed to reject enrollment request', details: rejectError.message },
        { status: 500 }
      );
    }

    // Fetch updated request with related data
    const { data: updatedRequest } = await supabase
      .from('enrollment_requests')
      .select(`
        id,
        user_id,
        course_id,
        status,
        created_at,
        updated_at,
        reviewed_by,
        reviewed_at,
        profiles:user_id (
          id,
          username,
          email
        ),
        courses (
          id,
          title
        )
      `)
      .eq('id', id)
      .single();

    return NextResponse.json({
      message: 'Enrollment request rejected successfully',
      request: updatedRequest,
    });
  } catch (error: any) {
    console.error('Error in POST /api/admin/enrollment-requests/[id]/reject:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

