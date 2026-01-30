import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, verifyTokenAndGetUser } from '@/lib/supabase-server';
import type { UnreadCountResponse } from '@/types/notification';

export const dynamic = 'force-dynamic';

// GET: Get unread notification count for the current user
export async function GET(request: NextRequest) {
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

    // Use service role client to bypass RLS and get accurate count
    const supabase = createServiceRoleClient(token);

    // Direct count query instead of RPC for more reliable execution
    const { count, error: countError } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false);

    if (countError) {
      console.error('[Unread Count API] Error getting unread count:', countError);
      return NextResponse.json(
        { error: 'Failed to get unread count', details: countError.message },
        { status: 500 }
      );
    }

    const response: UnreadCountResponse = {
      count: count || 0,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[Unread Count API] Unhandled exception:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
