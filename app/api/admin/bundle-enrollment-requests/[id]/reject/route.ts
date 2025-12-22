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

// POST: Reject a bundle enrollment request (admin only)
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
        { error: 'Bundle enrollment request ID is required' },
        { status: 400 }
      );
    }

    console.log('[Reject API] Attempting to reject bundle request:', id);
    
    // Use service role client to ensure we bypass RLS and get immediate updates
    const serviceSupabase = createServiceRoleClient();
    
    // Use the database function to reject (ensures consistency and bypasses RLS)
    // Pass admin user ID as parameter since we're using service role client
    const { error: rejectError } = await serviceSupabase.rpc('reject_bundle_enrollment_request', {
      request_id: id,
      admin_user_id: user.id,
    });

    if (rejectError) {
      console.error('[Reject API] Error rejecting bundle enrollment request:', {
        code: rejectError.code,
        message: rejectError.message,
        details: rejectError.details,
        hint: rejectError.hint
      });
      return NextResponse.json(
        { 
          error: 'Failed to reject bundle enrollment request', 
          details: rejectError.message || 'Unknown error occurred',
          code: rejectError.code
        },
        { status: 500 }
      );
    }
    
    // Verify the update was successful by querying the request directly
    const { data: updatedRequest, error: verifyError } = await serviceSupabase
      .from('bundle_enrollment_requests')
      .select('id, status, updated_at')
      .eq('id', id)
      .single();
    
    if (verifyError) {
      console.error('[Reject API] Error verifying bundle rejection:', verifyError);
    } else {
      console.log('[Reject API] Bundle rejection successful, verified status:', updatedRequest?.status, 'updated_at:', updatedRequest?.updated_at);
    }

    // Return success - the frontend will refresh the list
    return NextResponse.json({
      message: 'Bundle enrollment request rejected successfully',
      success: true
    });
  } catch (error: any) {
    console.error('Error in POST /api/admin/bundle-enrollment-requests/[id]/reject:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message || 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}


