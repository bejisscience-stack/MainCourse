import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, verifyTokenAndGetUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// PATCH: Mark a single notification as read
export async function PATCH(
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

    // Await params (Next.js 15 requirement)
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Notification ID is required' },
        { status: 400 }
      );
    }

    // Use service role client to bypass RLS and ensure update succeeds
    const supabase = createServiceRoleClient(token);

    console.log('[Mark Read API] Marking notification as read:', id, 'for user:', user.id);

    // Update the notification with explicit user_id check for security
    const { data: notification, error: updateError } = await supabase
      .from('notifications')
      .update({
        read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id) // Security check - only update user's own notifications
      .select()
      .single();

    if (updateError) {
      console.error('[Mark Read API] Error updating notification:', updateError);

      if (updateError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Notification not found or you do not have permission to update it' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to mark notification as read', details: updateError.message },
        { status: 500 }
      );
    }

    console.log('[Mark Read API] Successfully marked notification as read:', id);

    return NextResponse.json({
      success: true,
      notification,
    });
  } catch (error: any) {
    console.error('[Mark Read API] Unhandled exception:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
