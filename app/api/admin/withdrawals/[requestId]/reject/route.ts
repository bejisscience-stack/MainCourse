import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyTokenAndGetUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Helper function to check if user is admin using RPC function (bypasses RLS)
async function checkAdmin(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .rpc('check_is_admin', { user_id: userId });

    if (error) {
      console.error('[Admin Withdrawals Reject API] Error checking admin status:', error);
      return false;
    }

    return data === true;
  } catch (err) {
    console.error('[Admin Withdrawals Reject API] Exception checking admin:', err);
    return false;
  }
}

// POST: Reject withdrawal request (admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
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

    const { requestId } = await params;
    
    if (!requestId) {
      return NextResponse.json(
        { error: 'Request ID is required' },
        { status: 400 }
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

    // Get admin notes from body if provided
    let adminNotes: string | null = null;
    try {
      const body = await request.json();
      adminNotes = body.adminNotes || null;
    } catch {
      // Body is optional
    }

    // Call the RPC function to reject withdrawal using user's token
    // (RPC uses auth.uid() internally to verify admin status)
    const { error: rpcError } = await supabase
      .rpc('reject_withdrawal_request', {
        p_request_id: requestId,
        p_admin_notes: adminNotes
      });

    if (rpcError) {
      console.error('[Admin Withdrawals Reject API] Error rejecting withdrawal request:', rpcError);
      return NextResponse.json(
        { error: rpcError.message || 'Failed to reject withdrawal request' },
        { status: 400 }
      );
    }

    console.log('[Admin Withdrawals Reject API] Successfully rejected withdrawal request:', requestId);

    return NextResponse.json({ 
      success: true,
      message: 'Withdrawal request rejected'
    });
  } catch (error: any) {
    console.error('[Admin Withdrawals Reject API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

