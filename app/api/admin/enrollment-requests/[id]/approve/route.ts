import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient, verifyTokenAndGetUser } from '@/lib/supabase-server';

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

// POST: Approve an enrollment request (admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    // Await params (Next.js 15 requirement)
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Enrollment request ID is required' },
        { status: 400 }
      );
    }

    console.log('[Approve API] Attempting to approve request:', id);
    
    // Use service role client to ensure we bypass RLS and get immediate updates
    const serviceSupabase = createServiceRoleClient();
    
    // Use the database function to approve (ensures consistency and bypasses RLS)
    // Note: approve_enrollment_request returns void, so data will be null on success
    const { error: approveError } = await serviceSupabase.rpc('approve_enrollment_request', {
      request_id: id,
    });

    if (approveError) {
      console.error('[Approve API] Error approving enrollment request:', {
        code: approveError.code,
        message: approveError.message,
        details: approveError.details,
        hint: approveError.hint
      });
      return NextResponse.json(
        { 
          error: 'Failed to approve enrollment request', 
          details: approveError.message || 'Unknown error occurred',
          code: approveError.code
        },
        { status: 500 }
      );
    }
    
    // Verify the update was successful by querying the request directly
    const { data: updatedRequest, error: verifyError } = await serviceSupabase
      .from('enrollment_requests')
      .select('id, status, updated_at')
      .eq('id', id)
      .single();
    
    if (verifyError) {
      console.error('[Approve API] Error verifying approval:', verifyError);
    } else {
      console.log('[Approve API] Approval successful, verified status:', updatedRequest?.status, 'updated_at:', updatedRequest?.updated_at);
    }

    // Return success - the frontend will refresh the list automatically
    return NextResponse.json({
      message: 'Enrollment request approved successfully',
      success: true
    });
  } catch (error: any) {
    console.error('Error in POST /api/admin/enrollment-requests/[id]/approve:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message || 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}

