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
      console.error('[Messages API] Auth error:', userError);
      return NextResponse.json(
        { error: 'Unauthorized', details: userError?.message || 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Create Supabase client for database operations
    const supabase = createServerSupabaseClient(token);

    // Get the channel to find the course_id
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('id, course_id, name, type')
      .eq('id', chatId)
      .single();

    if (channelError || !channel) {
      console.error('[Messages API] Channel not found:', channelError);
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      );
    }

    // Check if user is admin first (admins can access all channels for moderation)
    const isAdmin = await checkIsAdmin(supabase, user.id);

    if (!isAdmin) {
      // Check if user is enrolled or is lecturer for non-admins
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('user_id', user.id)
        .eq('course_id', channel.course_id)
        .single();

      const { data: course } = await supabase
        .from('courses')
        .select('lecturer_id')
        .eq('id', channel.course_id)
        .single();

      const isLecturer = course?.lecturer_id === user.id;
      const isEnrolled = !!enrollment;

      if (!isEnrolled && !isLecturer) {
        return NextResponse.json(
          { error: 'Forbidden: You do not have access to this channel' },
          { status: 403 }
        );
      }
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const before = searchParams.get('before');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    // Build the query for messages
    let query = supabase
      .from('messages')
      .select(`
        id,
        content,
        user_id,
        reply_to_id,
        edited_at,
        created_at,
        channel_id,
        course_id
      `)
      .eq('channel_id', chatId)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Add pagination if 'before' is provided
    if (before) {
      query = query.lt('created_at', before);
    }

    const { data: messages, error: messagesError } = await query;

    if (messagesError) {
      console.error('[Messages API] Error fetching messages:', messagesError);
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ messages: [] });
    }

    // Get unique user IDs from messages
    const userIds = [...new Set(messages.map(m => m.user_id))];

    // Get reply message IDs
    const replyIds = messages
      .filter(m => m.reply_to_id)
      .map(m => m.reply_to_id);

    // Fetch user profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, email')
      .in('id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // Fetch reply messages if any
    let replyMap = new Map();
    if (replyIds.length > 0) {
      const { data: replyMessages } = await supabase
        .from('messages')
        .select('id, content, user_id')
        .in('id', replyIds);

      if (replyMessages) {
        // Get profiles for reply authors
        const replyUserIds = [...new Set(replyMessages.map(m => m.user_id))];
        const { data: replyProfiles } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', replyUserIds);

        const replyProfileMap = new Map(replyProfiles?.map(p => [p.id, p]) || []);

        for (const reply of replyMessages) {
          const replyProfile = replyProfileMap.get(reply.user_id);
          replyMap.set(reply.id, {
            id: reply.id,
            username: replyProfile?.username || 'User',
            content: reply.content.length > 100
              ? reply.content.substring(0, 100) + '...'
              : reply.content
          });
        }
      }
    }

    // Fetch attachments for all messages
    const messageIds = messages.map(m => m.id);
    const { data: attachments } = await supabase
      .from('message_attachments')
      .select('id, message_id, file_url, file_name, file_type, file_size, mime_type')
      .in('message_id', messageIds);

    // Group attachments by message_id
    const attachmentMap = new Map<string, any[]>();
    if (attachments) {
      for (const att of attachments) {
        if (!attachmentMap.has(att.message_id)) {
          attachmentMap.set(att.message_id, []);
        }
        attachmentMap.get(att.message_id)!.push({
          id: att.id,
          fileUrl: att.file_url,
          fileName: att.file_name,
          fileType: att.file_type,
          fileSize: att.file_size,
          mimeType: att.mime_type,
        });
      }
    }

    // Transform messages to the expected format
    const formattedMessages = messages.map(msg => {
      const profile = profileMap.get(msg.user_id);
      const replyPreview = msg.reply_to_id ? replyMap.get(msg.reply_to_id) : undefined;
      const messageAttachments = attachmentMap.get(msg.id);

      return {
        id: msg.id,
        user: {
          id: msg.user_id,
          username: profile?.username || 'User',
          avatarUrl: '', // Avatar URLs would come from storage if implemented
        },
        content: msg.content,
        timestamp: new Date(msg.created_at).getTime(),
        edited: !!msg.edited_at,
        replyTo: msg.reply_to_id || undefined,
        replyPreview,
        attachments: messageAttachments,
        reactions: [], // Reactions table not implemented yet
      };
    });

    // Reverse to get chronological order (oldest first)
    formattedMessages.reverse();

    return NextResponse.json({ messages: formattedMessages });
  } catch (error: any) {
    console.error('[Messages API] Error in GET /api/chats/[chatId]/messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
