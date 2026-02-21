import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, verifyTokenAndGetUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// PATCH: Mark all notifications as read for the current user
export async function PATCH(request: NextRequest) {
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

    // Use service role client to bypass RLS and ensure the update succeeds
    const supabase = createServiceRoleClient(token);

    console.log('[Mark All Read API] Marking all notifications as read for user:', user.id);

    // Direct UPDATE query instead of RPC for more reliable execution
    const { data, error: updateError, count } = await supabase
      .from('notifications')
      .update({
        read: true,
        read_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('read', false)
      .select('id');

    if (updateError) {
      console.error('[Mark All Read API] Error marking all as read:', updateError);
      return NextResponse.json(
        { error: 'Failed to mark all notifications as read', details: updateError.message },
        { status: 500 }
      );
    }

    const updatedCount = data?.length || 0;
    console.log('[Mark All Read API] Successfully marked', updatedCount, 'notifications as read');

    return NextResponse.json({
      success: true,
      count: updatedCount,
    });
  } catch (error: any) {
    console.error('[Mark All Read API] Unhandled exception:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
