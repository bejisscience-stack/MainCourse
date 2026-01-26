import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyTokenAndGetUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Helper function to check if user is admin using RPC function (bypasses RLS)
async function checkIsAdmin(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .rpc('check_is_admin', { user_id: userId });

    if (error) {
      console.error('[Messages API] Error checking admin status:', error);
      return false;
    }

    return data === true;
  } catch (err) {
    console.error('[Messages API] Exception checking admin:', err);
    return false;
  }
}

// Helper to verify channel access
async function verifyChannelAccess(
  supabase: any,
  chatId: string,
  userId: string
): Promise<{ channel: any; error?: string; status?: number }> {
  // Get channel
  const { data: channel, error: channelError } = await supabase
    .from('channels')
    .select('id, course_id, name, type')
    .eq('id', chatId)
    .single();

  if (channelError || !channel) {
    return { channel: null, error: 'Channel not found', status: 404 };
  }

  // Check if user is admin first
  const isAdmin = await checkIsAdmin(supabase, userId);

  if (!isAdmin) {
    // Check enrollment
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('user_id', userId)
      .eq('course_id', channel.course_id)
      .single();

    // Check if lecturer
    const { data: course } = await supabase
      .from('courses')
      .select('lecturer_id')
      .eq('id', channel.course_id)
      .single();

    const isLecturer = course?.lecturer_id === userId;
    const isEnrolled = !!enrollment;

    if (!isEnrolled && !isLecturer) {
      return { channel: null, error: 'Forbidden: You do not have access to this channel', status: 403 };
    }
  }

  return { channel };
}

// GET /api/chats/:chatId/messages
export async function GET(
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
      return NextResponse.json(
        { error: 'Unauthorized', details: userError?.message || 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Create Supabase client for database operations
    const supabase = createServerSupabaseClient(token);

    // Verify channel access
    const { channel, error: accessError, status: accessStatus } = await verifyChannelAccess(
      supabase,
      chatId,
      user.id
    );

    if (accessError) {
      return NextResponse.json({ error: accessError }, { status: accessStatus });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const before = searchParams.get('before');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    // Build query
    let query = supabase
      .from('messages')
      .select('id, content, user_id, reply_to_id, edited_at, created_at, channel_id, course_id')
      .eq('channel_id', chatId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data: messages, error: messagesError } = await query;

    if (messagesError) {
      console.error('[Messages API] Error fetching messages:', messagesError);
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ messages: [] });
    }

    // Get user profiles, reply messages, and attachments in parallel
    const userIds = [...new Set(messages.map(m => m.user_id))];
    const replyIds = messages.filter(m => m.reply_to_id).map(m => m.reply_to_id);
    const messageIds = messages.map(m => m.id);

    const [profilesResult, replyMessagesResult, attachmentsResult] = await Promise.all([
      supabase.from('profiles').select('id, username, email').in('id', userIds),
      replyIds.length > 0
        ? supabase.from('messages').select('id, content, user_id').in('id', replyIds)
        : Promise.resolve({ data: null }),
      supabase.from('message_attachments')
        .select('id, message_id, file_url, file_name, file_type, file_size, mime_type')
        .in('message_id', messageIds),
    ]);

    // Build profile map
    const profileMap = new Map(profilesResult.data?.map(p => [p.id, p]) || []);

    // Build reply map with user info
    const replyMap = new Map();
    if (replyMessagesResult.data?.length) {
      const replyUserIds = [...new Set(replyMessagesResult.data.map(m => m.user_id))];
      const { data: replyProfiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', replyUserIds);

      const replyProfileMap = new Map(replyProfiles?.map(p => [p.id, p]) || []);

      for (const reply of replyMessagesResult.data) {
        const replyProfile = replyProfileMap.get(reply.user_id);
        replyMap.set(reply.id, {
          id: reply.id,
          username: replyProfile?.username || 'User',
          content: reply.content.length > 100 ? reply.content.substring(0, 100) + '...' : reply.content,
        });
      }
    }

    // Build attachment map
    const attachmentMap = new Map();
    if (attachmentsResult.data) {
      for (const att of attachmentsResult.data) {
        if (!attachmentMap.has(att.message_id)) {
          attachmentMap.set(att.message_id, []);
        }
        attachmentMap.get(att.message_id).push({
          id: att.id,
          fileUrl: att.file_url,
          fileName: att.file_name,
          fileType: att.file_type,
          fileSize: att.file_size,
          mimeType: att.mime_type,
        });
      }
    }

    // Format messages
    const formattedMessages = messages.map(msg => {
      const profile = profileMap.get(msg.user_id);
      return {
        id: msg.id,
        user: {
          id: msg.user_id,
          username: profile?.username || 'User',
          avatarUrl: '',
        },
        content: msg.content,
        timestamp: new Date(msg.created_at).getTime(),
        edited: !!msg.edited_at,
        replyTo: msg.reply_to_id || undefined,
        replyPreview: msg.reply_to_id ? replyMap.get(msg.reply_to_id) : undefined,
        attachments: attachmentMap.get(msg.id),
        reactions: [],
      };
    });

    // Reverse to get chronological order (oldest first)
    formattedMessages.reverse();

    return NextResponse.json({ messages: formattedMessages });
  } catch (error: any) {
    console.error('Error in GET /api/chats/[chatId]/messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/chats/:chatId/messages
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
      return NextResponse.json(
        { error: 'Unauthorized', details: userError?.message || 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Create Supabase client for database operations
    const supabase = createServerSupabaseClient(token);

    // Verify channel access
    const { channel, error: accessError, status: accessStatus } = await verifyChannelAccess(
      supabase,
      chatId,
      user.id
    );

    if (accessError) {
      return NextResponse.json({ error: accessError }, { status: accessStatus });
    }

    // Parse request body
    const body = await request.json();
    const { content, replyTo } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      );
    }

    // Insert message
    const { data: message, error: insertError } = await supabase
      .from('messages')
      .insert({
        channel_id: chatId,
        course_id: channel.course_id,
        user_id: user.id,
        content: content.trim(),
        reply_to_id: replyTo || null,
      })
      .select('id, content, user_id, reply_to_id, edited_at, created_at')
      .single();

    if (insertError) {
      console.error('[Messages API] Error inserting message:', insertError);
      return NextResponse.json(
        { error: 'Failed to send message' },
        { status: 500 }
      );
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('id', user.id)
      .single();

    // Get reply preview if replying
    let replyPreview = undefined;
    if (replyTo) {
      const { data: replyMessage } = await supabase
        .from('messages')
        .select('id, content, user_id')
        .eq('id', replyTo)
        .single();

      if (replyMessage) {
        const { data: replyProfile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', replyMessage.user_id)
          .single();

        replyPreview = {
          id: replyMessage.id,
          username: replyProfile?.username || 'User',
          content: replyMessage.content.length > 100
            ? replyMessage.content.substring(0, 100) + '...'
            : replyMessage.content,
        };
      }
    }

    // Format response
    const formattedMessage = {
      id: message.id,
      user: {
        id: message.user_id,
        username: profile?.username || 'User',
        avatarUrl: '',
      },
      content: message.content,
      timestamp: new Date(message.created_at).getTime(),
      edited: false,
      replyTo: message.reply_to_id || undefined,
      replyPreview,
      reactions: [],
    };

    return NextResponse.json({ message: formattedMessage }, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/chats/[chatId]/messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
