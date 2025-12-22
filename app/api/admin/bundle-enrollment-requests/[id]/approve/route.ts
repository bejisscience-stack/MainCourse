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

// POST: Approve a bundle enrollment request (admin only)
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

    console.log('[Approve API] Attempting to approve bundle request:', id);
    
    // Use the database function to approve (ensures consistency and bypasses RLS)
    const { error: approveError } = await supabase.rpc('approve_bundle_enrollment_request', {
      request_id: id,
    });

    if (approveError) {
      console.error('[Approve API] Error approving bundle enrollment request:', {
        code: approveError.code,
        message: approveError.message,
        details: approveError.details,
        hint: approveError.hint
      });
      return NextResponse.json(
        { 
          error: 'Failed to approve bundle enrollment request', 
          details: approveError.message || 'Unknown error occurred',
          code: approveError.code
        },
        { status: 500 }
      );
    }
    
    console.log('[Approve API] Bundle approval successful');

    // Return success - the frontend will refresh the list automatically
    return NextResponse.json({
      message: 'Bundle enrollment request approved successfully',
      success: true
    });
  } catch (error: any) {
    console.error('Error in POST /api/admin/bundle-enrollment-requests/[id]/approve:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message || 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}


