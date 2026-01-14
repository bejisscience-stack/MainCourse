import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient, verifyTokenAndGetUser } from '@/lib/supabase-server';
import { sendWithdrawalRejectedEmail } from '@/lib/email';

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

    // Create authenticated client for RPC calls that rely on auth.uid()
    const supabase = createServerSupabaseClient(token);

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

    // Use authenticated client (not service role) so auth.uid() works in the database function
    // The reject_withdrawal_request function uses auth.uid() to verify admin status
    // Note: No balance refund needed since balance is not deducted when creating a pending request
    const { error: rejectError } = await supabase
      .rpc('reject_withdrawal_request', {
        p_request_id: requestId,
        p_admin_notes: adminNotes
      });

    if (rejectError) {
      console.error('[Reject Withdrawal API] RPC error:', rejectError);
      return NextResponse.json(
        { error: rejectError.message || 'Failed to reject withdrawal request' },
        { status: 500 }
      );
    }

    console.log('[Reject Withdrawal API] Request rejected successfully:', requestId);

    // Create notification for the user
    try {
      const { error: notificationError } = await serviceSupabase
        .rpc('create_notification', {
          p_user_id: withdrawalRequest.user_id,
          p_type: 'withdrawal_rejected',
          p_title_en: 'Withdrawal Request Update',
          p_title_ge: 'თანხის გატანის მოთხოვნის განახლება',
          p_message_en: `Your withdrawal request for ₾${withdrawalRequest.amount.toFixed(2)} was not approved. Reason: ${adminNotes}`,
          p_message_ge: `თქვენი თანხის გატანის მოთხოვნა ₾${withdrawalRequest.amount.toFixed(2)}-ზე არ დამტკიცდა. მიზეზი: ${adminNotes}`,
          p_metadata: {
            request_id: requestId,
            amount: withdrawalRequest.amount,
            reason: adminNotes,
          },
          p_created_by: user.id,
        });

      if (notificationError) {
        console.error('[Reject Withdrawal API] Error creating notification:', notificationError);
      } else {
        console.log('[Reject Withdrawal API] Notification created for user:', withdrawalRequest.user_id);
      }
    } catch (notifError) {
      console.error('[Reject Withdrawal API] Exception creating notification:', notifError);
    }

    // Send email notification
    try {
      const { data: userProfile } = await serviceSupabase
        .from('profiles')
        .select('email')
        .eq('id', withdrawalRequest.user_id)
        .single();

      if (userProfile?.email) {
        await sendWithdrawalRejectedEmail(userProfile.email, withdrawalRequest.amount, adminNotes);
        console.log('[Reject Withdrawal API] Email sent to:', userProfile.email);
      }
    } catch (emailError) {
      console.error('[Reject Withdrawal API] Error sending email:', emailError);
    }

    return NextResponse.json({
      success: true,
      message: 'Withdrawal request rejected successfully'
    });
  } catch (error: any) {
    console.error('[Reject Withdrawal API] Unhandled exception:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
