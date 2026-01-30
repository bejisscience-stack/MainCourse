import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyTokenAndGetUser } from '@/lib/supabase-server';
import type { Notification, NotificationsResponse } from '@/types/notification';

export const dynamic = 'force-dynamic';

// GET: Fetch user's notifications with pagination
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

    const supabase = createServerSupabaseClient(token);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const unreadOnly = searchParams.get('unread') === 'true';

    const offset = (page - 1) * limit;

    console.log('[Notifications API] Fetching notifications for user:', user.id, { page, limit, unreadOnly });

    // Build query
    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (unreadOnly) {
      query = query.eq('read', false);
    }

    const { data: notifications, error: fetchError, count } = await query;

    if (fetchError) {
      console.error('[Notifications API] Error fetching notifications:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch notifications', details: fetchError.message },
        { status: 500 }
      );
    }

    const total = count || 0;
    const hasMore = offset + limit < total;

    const response: NotificationsResponse = {
      notifications: notifications as Notification[],
      total,
      page,
      limit,
      hasMore,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[Notifications API] Unhandled exception:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
