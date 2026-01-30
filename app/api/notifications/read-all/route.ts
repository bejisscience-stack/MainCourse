import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyTokenAndGetUser } from '@/lib/supabase-server';

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

    const supabase = createServerSupabaseClient(token);

    console.log('[Mark All Read API] Marking all notifications as read for user:', user.id);

    // Use RPC function to mark all as read
    const { data: count, error: rpcError } = await supabase
      .rpc('mark_all_notifications_read', { p_user_id: user.id });

    if (rpcError) {
      console.error('[Mark All Read API] Error marking all as read:', rpcError);
      return NextResponse.json(
        { error: 'Failed to mark all notifications as read', details: rpcError.message },
        { status: 500 }
      );
    }

    console.log('[Mark All Read API] Successfully marked', count, 'notifications as read');

    return NextResponse.json({
      success: true,
      count: count || 0,
    });
  } catch (error: any) {
    console.error('[Mark All Read API] Unhandled exception:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
