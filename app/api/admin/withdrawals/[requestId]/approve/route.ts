import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, verifyTokenAndGetUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Helper function to check if user is admin using RPC function (bypasses RLS)
async function checkAdmin(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .rpc('check_is_admin', { user_id: userId });

    if (error) {
      console.error('[Approve Withdrawal API] Error checking admin status:', error);
      return false;
    }

    return data === true;
  } catch (err) {
    console.error('[Approve Withdrawal API] Exception checking admin:', err);
    return false;
  }
}

// POST: Approve a withdrawal request
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

    console.log('[Approve Withdrawal API] Processing approval for request:', requestId);

    // Fetch the withdrawal request
    const { data: withdrawalRequest, error: fetchError } = await serviceSupabase
      .from('withdrawal_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !withdrawalRequest) {
      console.error('[Approve Withdrawal API] Request not found:', fetchError);
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

    // Update the withdrawal request status
    const { error: updateError } = await serviceSupabase
      .from('withdrawal_requests')
      .update({
        status: 'approved',
        admin_notes: adminNotes || null,
        processed_at: new Date().toISOString(),
        processed_by: user.id,
      })
      .eq('id', requestId);

    if (updateError) {
      console.error('[Approve Withdrawal API] Failed to update request:', updateError);
      return NextResponse.json(
        { error: 'Failed to approve withdrawal request' },
        { status: 500 }
      );
    }

    console.log('[Approve Withdrawal API] Request approved successfully:', requestId);

    // Create notification for the user
    try {
      const { error: notificationError } = await serviceSupabase
        .rpc('create_notification', {
          p_user_id: withdrawalRequest.user_id,
          p_type: 'withdrawal_approved',
          p_title_en: 'Withdrawal Approved',
          p_title_ge: 'თანხის გატანა დამტკიცებულია',
          p_message_en: `Your withdrawal request for ₾${withdrawalRequest.amount.toFixed(2)} has been approved and will be processed soon.`,
          p_message_ge: `თქვენი თანხის გატანის მოთხოვნა ₾${withdrawalRequest.amount.toFixed(2)}-ზე დამტკიცებულია და მალე დამუშავდება.`,
          p_metadata: {
            request_id: requestId,
            amount: withdrawalRequest.amount,
          },
          p_created_by: user.id,
        });

      if (notificationError) {
        console.error('[Approve Withdrawal API] Error creating notification:', notificationError);
      } else {
        console.log('[Approve Withdrawal API] Notification created for user:', withdrawalRequest.user_id);
      }
    } catch (notifError) {
      console.error('[Approve Withdrawal API] Exception creating notification:', notifError);
    }

    return NextResponse.json({
      success: true,
      message: 'Withdrawal request approved successfully'
    });
  } catch (error: any) {
    console.error('[Approve Withdrawal API] Unhandled exception:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
