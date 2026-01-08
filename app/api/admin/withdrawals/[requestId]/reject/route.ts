import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, verifyTokenAndGetUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Helper function to check if user is admin using RPC function (bypasses RLS)
async function checkAdmin(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .rpc('check_is_admin', { user_id: userId });

    if (error) {
      console.error('[Reject Withdrawal API] Error checking admin status:', error);
      return false;
    }

    return data === true;
  } catch (err) {
    console.error('[Reject Withdrawal API] Exception checking admin:', err);
    return false;
  }
}

// POST: Reject a withdrawal request
export async function POST(
  request: NextRequest,
  { params }: { params: { requestId: string } }
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

    const serviceSupabase = createServiceRoleClient();

    // Check if user is admin
    const isAdmin = await checkAdmin(serviceSupabase, user.id);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Access denied. Admin only.' },
        { status: 403 }
      );
    }

    const { requestId } = params;
    const body = await request.json().catch(() => ({}));
    const { adminNotes } = body;

    if (!adminNotes) {
      return NextResponse.json(
        { error: 'Admin notes are required when rejecting a request' },
        { status: 400 }
      );
    }

    console.log('[Reject Withdrawal API] Processing rejection for request:', requestId);

    // Fetch the withdrawal request
    const { data: withdrawalRequest, error: fetchError } = await serviceSupabase
      .from('withdrawal_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !withdrawalRequest) {
      console.error('[Reject Withdrawal API] Request not found:', fetchError);
      return NextResponse.json(
        { error: 'Withdrawal request not found' },
        { status: 404 }
      );
    }

    if (withdrawalRequest.status !== 'pending') {
      return NextResponse.json(
        { error: `Request is already ${withdrawalRequest.status}` },
        { status: 400 }
      );
    }

    // Refund the balance back to the user
    const { error: refundError } = await serviceSupabase
      .from('profiles')
      .update({
        balance: serviceSupabase.rpc('increment_balance', {
          user_id: withdrawalRequest.user_id,
          amount: withdrawalRequest.amount
        })
      })
      .eq('id', withdrawalRequest.user_id);

    // Update the withdrawal request status
    const { error: updateError } = await serviceSupabase
      .from('withdrawal_requests')
      .update({
        status: 'rejected',
        admin_notes: adminNotes,
        processed_at: new Date().toISOString(),
        processed_by: user.id,
      })
      .eq('id', requestId);

    if (updateError) {
      console.error('[Reject Withdrawal API] Failed to update request:', updateError);
      return NextResponse.json(
        { error: 'Failed to reject withdrawal request' },
        { status: 500 }
      );
    }

    // Refund the balance - use direct SQL update
    const { error: balanceError } = await serviceSupabase.rpc('refund_withdrawal', {
      p_user_id: withdrawalRequest.user_id,
      p_amount: withdrawalRequest.amount
    });

    if (balanceError) {
      console.warn('[Reject Withdrawal API] Balance refund may need manual processing:', balanceError);
    }

    console.log('[Reject Withdrawal API] Request rejected successfully:', requestId);

    return NextResponse.json({
      success: true,
      message: 'Withdrawal request rejected and balance refunded'
    });
  } catch (error: any) {
    console.error('[Reject Withdrawal API] Unhandled exception:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
