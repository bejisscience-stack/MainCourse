import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyTokenAndGetUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// POST /api/chats/:chatId/mute - Mute a user in a channel
export async function POST(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    const { chatId } = params;
    const body = await request.json();
    const { userId } = body;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

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

    // Get channel and course
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

    // Check if user is lecturer
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('lecturer_id')
      .eq('id', channel.course_id)
      .single();

    if (courseError || !course) {
      return NextResponse.json(
        { error: 'Course not found' },
        { status: 404 }
      );
    }

    if (course.lecturer_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: Only lecturers can mute users' },
        { status: 403 }
      );
    }

    // Insert mute record
    const { data: mutedUser, error: muteError } = await supabase
      .from('muted_users')
      .insert({
        channel_id: chatId,
        course_id: channel.course_id,
        user_id: userId,
        muted_by: user.id,
      })
      .select()
      .single();

    if (muteError) {
      if (muteError.code === '23505') {
        // Already muted
        return NextResponse.json(
          { error: 'User is already muted' },
          { status: 409 }
        );
      }
      console.error('Error muting user:', muteError);
      return NextResponse.json(
        { error: 'Failed to mute user', details: muteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ muted: true, mutedUser }, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/chats/[chatId]/mute:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/chats/:chatId/mute - Unmute a user in a channel
export async function DELETE(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    const { chatId } = params;
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

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

    // Get channel and course
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

    // Check if user is lecturer
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('lecturer_id')
      .eq('id', channel.course_id)
      .single();

    if (courseError || !course) {
      return NextResponse.json(
        { error: 'Course not found' },
        { status: 404 }
      );
    }

    if (course.lecturer_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: Only lecturers can unmute users' },
        { status: 403 }
      );
    }

    // Delete mute record
    const { error: unmuteError } = await supabase
      .from('muted_users')
      .delete()
      .eq('channel_id', chatId)
      .eq('user_id', userId);

    if (unmuteError) {
      console.error('Error unmuting user:', unmuteError);
      return NextResponse.json(
        { error: 'Failed to unmute user', details: unmuteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ unmuted: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error in DELETE /api/chats/[chatId]/mute:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// GET /api/chats/:chatId/mute - Check if user is muted
export async function GET(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    const { chatId } = params;
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId') || undefined;

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
    const checkUserId = userId || user.id;

    // Check if user is muted
    const { data: mutedUser, error: muteError } = await supabase
      .from('muted_users')
      .select('id, user_id, muted_by, created_at')
      .eq('channel_id', chatId)
      .eq('user_id', checkUserId)
      .single();

    if (muteError && muteError.code !== 'PGRST116') {
      console.error('Error checking mute status:', muteError);
      return NextResponse.json(
        { error: 'Failed to check mute status', details: muteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ muted: !!mutedUser, mutedUser: mutedUser || null });
  } catch (error: any) {
    console.error('Error in GET /api/chats/[chatId]/mute:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}


