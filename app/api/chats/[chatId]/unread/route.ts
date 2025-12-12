import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyTokenAndGetUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET /api/chats/:chatId/unread - Get unread count for a channel
export async function GET(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    const { chatId } = params;

    // Get auth token
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
        { error: 'Unauthorized', details: userError?.message || 'Invalid token' },
        { status: 401 }
      );
    }

    const supabase = createServerSupabaseClient(token);

    // Get unread count
    const { data: unreadData, error: unreadError } = await supabase
      .from('unread_messages')
      .select('unread_count, last_read_at')
      .eq('channel_id', chatId)
      .eq('user_id', user.id)
      .single();

    if (unreadError && unreadError.code !== 'PGRST116') {
      console.error('Error fetching unread count:', unreadError);
      return NextResponse.json(
        { error: 'Failed to fetch unread count', details: unreadError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      unreadCount: unreadData?.unread_count || 0,
      lastReadAt: unreadData?.last_read_at || null,
    });
  } catch (error: any) {
    console.error('Error in GET /api/chats/[chatId]/unread:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/chats/:chatId/unread - Mark channel as read (reset unread count)
export async function POST(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    const { chatId } = params;

    // Get auth token
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
        { error: 'Unauthorized', details: userError?.message || 'Invalid token' },
        { status: 401 }
      );
    }

    const supabase = createServerSupabaseClient(token);

    // Get channel to get course_id
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('id, course_id')
      .eq('id', chatId)
      .single();

    if (channelError || !channel) {
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      );
    }

    // Reset unread count
    const { data: unreadData, error: resetError } = await supabase
      .from('unread_messages')
      .upsert({
        channel_id: chatId,
        course_id: channel.course_id,
        user_id: user.id,
        unread_count: 0,
        last_read_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'channel_id,user_id',
      })
      .select()
      .single();

    if (resetError) {
      console.error('Error resetting unread count:', resetError);
      return NextResponse.json(
        { error: 'Failed to reset unread count', details: resetError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      unreadCount: 0,
      lastReadAt: unreadData.last_read_at,
    });
  } catch (error: any) {
    console.error('Error in POST /api/chats/[chatId]/unread:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}


