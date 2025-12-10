import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyTokenAndGetUser } from '@/lib/supabase-server';

// POST /api/chats/:chatId/typing
export async function POST(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    const { chatId } = params;

    // Get auth token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify token and get user
    const { user, error: userError } = await verifyTokenAndGetUser(token);
    if (userError || !user) {
      console.error('Auth error:', userError);
      return NextResponse.json(
        { error: 'Unauthorized', details: userError?.message || 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Create Supabase client for database operations
    const supabase = createServerSupabaseClient(token);

    // Get channel and verify access
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

    const courseId = channel.course_id;
    
    // Fetch course separately to get lecturer_id
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('lecturer_id')
      .eq('id', courseId)
      .single();
    
    const lecturerId = course?.lecturer_id;

    // Check enrollment or lecturer status
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .single();

    const isLecturer = lecturerId === user.id;
    const isEnrolled = !!enrollment;

    if (!isEnrolled && !isLecturer) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have access to this channel' },
        { status: 403 }
      );
    }

    // Upsert typing indicator (expires in 3 seconds)
    const expiresAt = new Date(Date.now() + 3000).toISOString();
    
    const { error: upsertError } = await supabase
      .from('typing_indicators')
      .upsert({
        channel_id: chatId,
        user_id: user.id,
        expires_at: expiresAt,
      }, {
        onConflict: 'channel_id,user_id',
      });

    if (upsertError) {
      console.error('Error upserting typing indicator:', upsertError);
      return NextResponse.json(
        { error: 'Failed to update typing indicator' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in POST /api/chats/[chatId]/typing:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
