import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyTokenAndGetUser } from '@/lib/supabase-server';
import { normalizeProfileUsername } from '@/lib/username';

export const dynamic = 'force-dynamic';

// GET /api/chats/:chatId/messages
export async function GET(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    const { chatId } = params;
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const before = searchParams.get('before'); // timestamp for pagination

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
      
      // Provide more helpful error message for session issues
      let errorDetails = userError?.message || 'Invalid or expired token';
      if (errorDetails.includes('session') || errorDetails.includes('Session')) {
        errorDetails = 'Your session has expired. Please refresh the page or log in again.';
      }
      
      return NextResponse.json(
        { error: 'Unauthorized', details: errorDetails },
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
      console.error('Channel error:', channelError);
      return NextResponse.json(
        { error: 'Channel not found', details: channelError?.message },
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
    
    if (courseError || !course) {
      console.error('Course error:', courseError);
      return NextResponse.json(
        { error: 'Course not found', details: courseError?.message || 'The course associated with this channel does not exist' },
        { status: 404 }
      );
    }
    
    const lecturerId = course.lecturer_id;

    // Check enrollment or lecturer status
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .single();

    // enrollmentError is expected if user is not enrolled (no rows found)
    // Only treat it as an error if it's not a "not found" type error
    if (enrollmentError && enrollmentError.code !== 'PGRST116') {
      console.error('Enrollment check error:', enrollmentError);
    }

    const isLecturer = lecturerId === user.id;
    const isEnrolled = !!enrollment;

    if (!isEnrolled && !isLecturer) {
      return NextResponse.json(
        { error: 'Access denied', details: 'You must be enrolled in this course or be the course lecturer to view messages' },
        { status: 403 }
      );
    }

    // Build query - fetch messages first without profile join due to RLS
    let query = supabase
      .from('messages')
      .select(`
        id,
        content,
        reply_to_id,
        edited_at,
        created_at,
        updated_at,
        user_id
      `)
      .eq('channel_id', chatId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data: messages, error } = await query;

    if (error) {
      console.error('Error fetching messages:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        channelId: chatId,
        courseId,
        userId: user.id,
        isLecturer,
        isEnrolled,
      });
      
      // Provide more helpful error messages based on error code
      let errorMessage = 'Failed to fetch messages';
      let errorDetails = error.message;
      
      if (error.code === 'PGRST301' || error.message?.includes('permission denied') || error.message?.includes('row-level security')) {
        errorMessage = 'Permission denied';
        errorDetails = 'You do not have permission to view messages in this channel. Please ensure you are enrolled in the course or are the course lecturer.';
      } else if (error.code === '42P01') {
        errorMessage = 'Database error';
        errorDetails = 'The messages table may not exist. Please check your database migrations.';
      }
      
      return NextResponse.json(
        { error: errorMessage, details: errorDetails },
        { status: 500 }
      );
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ messages: [] });
    }

    // Fetch profiles separately for all unique user IDs
    const userIds = [...new Set(messages.map((msg: any) => msg.user_id))];
    
    // Fetch profiles - RLS should allow viewing all profiles (migration 045)
    const profileMap = new Map();
    
    if (userIds.length > 0) {
      // Batch fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, email')
        .in('id', userIds);

      if (profiles && !profilesError) {
        profiles.forEach((profile: any) => {
          profileMap.set(profile.id, profile);
          // Log if username is missing
          if (!profile.username || profile.username.trim() === '') {
            console.warn(`Profile for user ${profile.id} exists but username is empty. Email: ${profile.email}`);
          }
        });
        console.log(`Successfully fetched ${profiles.length} profiles out of ${userIds.length} users`);
      } else {
        console.error('Failed to fetch profiles:', profilesError);
        // Try individual fetches as fallback
        for (const userId of userIds) {
          try {
            const { data: singleProfile, error: singleError } = await supabase
              .from('profiles')
              .select('id, username, email')
              .eq('id', userId)
              .single();
            
            if (singleProfile && !singleError) {
              profileMap.set(userId, singleProfile);
            } else {
              console.warn(`Failed to fetch profile for user ${userId}:`, singleError);
            }
          } catch (err: any) {
            console.warn(`Exception fetching profile for user ${userId}:`, err);
          }
        }
      }
    }

    // Transform messages to include user info
    // If profile fetch failed, log it for debugging
    if (userIds.length > 0 && profileMap.size === 0) {
      console.error(`CRITICAL: Failed to fetch ANY profiles for ${userIds.length} users. This suggests an RLS policy issue.`);
      console.error('User IDs:', userIds);
      console.error('Current user ID:', user.id);
      console.error('Channel course ID:', courseId);
    } else if (userIds.length > 0 && profileMap.size < userIds.length) {
      const missingIds = userIds.filter(id => !profileMap.has(id));
      console.warn(`Warning: Failed to fetch profiles for ${missingIds.length} users:`, missingIds);
    }

    // Fetch attachments for all messages
    const messageIds = (messages || []).map((msg: any) => msg.id);
    const attachmentsMap = new Map();
    
    if (messageIds.length > 0) {
      const { data: attachments } = await supabase
        .from('message_attachments')
        .select('*')
        .in('message_id', messageIds);
      
      if (attachments) {
        attachments.forEach((att: any) => {
          if (!attachmentsMap.has(att.message_id)) {
            attachmentsMap.set(att.message_id, []);
          }
          attachmentsMap.get(att.message_id).push({
            id: att.id,
            fileUrl: att.file_url,
            fileName: att.file_name,
            fileType: att.file_type,
            fileSize: att.file_size,
            mimeType: att.mime_type,
          });
        });
      }
    }

    // Fetch reply previews for messages that have replies
    const replyToIds = (messages || []).filter((msg: any) => msg.reply_to_id).map((msg: any) => msg.reply_to_id);
    const replyPreviewsMap = new Map();
    
    if (replyToIds.length > 0) {
      const { data: replyMessages } = await supabase
        .from('messages')
        .select('id, content, user_id')
        .in('id', replyToIds);
      
      if (replyMessages) {
        for (const replyMsg of replyMessages) {
          const replyProfile = profileMap.get(replyMsg.user_id);
          const replyUsername = replyProfile
            ? normalizeProfileUsername(replyProfile)
            : 'User';
          
          replyPreviewsMap.set(replyMsg.id, {
            id: replyMsg.id,
            username: replyUsername,
            content: replyMsg.content.substring(0, 50) + (replyMsg.content.length > 50 ? '...' : ''),
          });
        }
      }
    }

    const transformedMessages = (messages || []).map((msg: any) => {
      const profile = profileMap.get(msg.user_id);
      const username = profile ? normalizeProfileUsername(profile) : 'User';
      
      const messageAttachments = attachmentsMap.get(msg.id) || [];
      const replyPreview = msg.reply_to_id ? replyPreviewsMap.get(msg.reply_to_id) : undefined;
      
      return {
        id: msg.id,
        content: msg.content,
        replyTo: msg.reply_to_id,
        replyPreview,
        attachments: messageAttachments.length > 0 ? messageAttachments : undefined,
        edited: !!msg.edited_at,
        timestamp: new Date(msg.created_at).getTime(),
        user: {
          id: msg.user_id,
          username,
          avatarUrl: '',
        },
      };
    }).reverse(); // Reverse to show oldest first

    return NextResponse.json({ messages: transformedMessages });
  } catch (error: any) {
    console.error('Error in GET /api/chats/[chatId]/messages:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
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
    const body = await request.json();
    const { content, replyTo, attachments } = body;

    // Allow messages with content OR attachments (or both)
    const hasContent = content && typeof content === 'string' && content.trim().length > 0;
    const hasAttachments = attachments && Array.isArray(attachments) && attachments.length > 0;
    
    if (!hasContent && !hasAttachments) {
      return NextResponse.json(
        { error: 'Message must have content or attachments' },
        { status: 400 }
      );
    }

    if (hasContent && content.length > 4000) {
      return NextResponse.json(
        { error: 'Message content is too long (max 4000 characters)' },
        { status: 400 }
      );
    }

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
      
      // Provide more helpful error message for session issues
      let errorDetails = userError?.message || 'Invalid or expired token';
      if (errorDetails.includes('session') || errorDetails.includes('Session')) {
        errorDetails = 'Your session has expired. Please refresh the page or log in again.';
      }
      
      return NextResponse.json(
        { error: 'Unauthorized', details: errorDetails },
        { status: 401 }
      );
    }

    // Create Supabase client for database operations
    const supabase = createServerSupabaseClient(token);

    // Get channel and verify access
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('id, course_id, name, type')
      .eq('id', chatId)
      .single();

    if (channelError || !channel) {
      console.error('Channel error:', channelError);
      return NextResponse.json(
        { error: 'Channel not found', details: channelError?.message },
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
    
    if (courseError || !course) {
      console.error('Course error:', courseError);
      return NextResponse.json(
        { error: 'Course not found', details: courseError?.message || 'The course associated with this channel does not exist' },
        { status: 404 }
      );
    }
    
    const lecturerId = course.lecturer_id;

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

    // Check if this is a restricted channel (Lectures or Projects)
    const channelName = channel.name?.toLowerCase() || '';
    const isLecturesChannel = channelName === 'lectures' && channel.type === 'lectures';
    const isProjectsChannel = channelName === 'projects';
    const isRestrictedChannel = isLecturesChannel || isProjectsChannel;

    // Only lecturers can send messages in Lectures and Projects channels
    if (isRestrictedChannel && !isLecturer) {
      return NextResponse.json(
        { error: 'Forbidden: Only the course lecturer can send messages in this channel' },
        { status: 403 }
      );
    }

    // Check if user is muted by this lecturer (lecturer-wise mute)
    const { data: mutedUser } = await supabase
      .from('muted_users')
      .select('id')
      .eq('lecturer_id', lecturerId)
      .eq('user_id', user.id)
      .single();

    if (mutedUser) {
      return NextResponse.json(
        { error: 'You have been muted by the lecturer' },
        { status: 403 }
      );
    }

    // Sanitize content (basic XSS prevention) - allow empty content for attachment-only messages
    const sanitizedContent = hasContent 
      ? content.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      : '';

    // Insert message
    const { data: message, error: insertError } = await supabase
      .from('messages')
      .insert({
        channel_id: chatId,
        course_id: courseId,
        user_id: user.id,
        content: sanitizedContent,
        reply_to_id: replyTo || null,
      })
      .select(`
        id,
        content,
        reply_to_id,
        edited_at,
        created_at,
        updated_at,
        user_id
      `)
      .single();

    if (insertError) {
      console.error('Error inserting message:', insertError);
      return NextResponse.json(
        { error: 'Failed to send message', details: insertError.message },
        { status: 500 }
      );
    }

    // Insert attachments if provided
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      const attachmentRecords = attachments.map((att: any) => ({
        message_id: message.id,
        channel_id: chatId,
        course_id: courseId,
        file_url: att.fileUrl,
        file_name: att.fileName,
        file_type: att.fileType,
        file_size: att.fileSize,
        mime_type: att.mimeType,
      }));

      const { error: attachmentsError } = await supabase
        .from('message_attachments')
        .insert(attachmentRecords);

      if (attachmentsError) {
        console.error('Error inserting attachments:', attachmentsError);
        // Don't fail the whole request, just log the error
      }
    }

    // Fetch user profile separately with better error handling
    let profile = null;
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, email')
      .eq('id', user.id)
      .single();

    if (profileData && !profileError) {
      profile = profileData;
    } else {
      console.warn('Failed to fetch profile for message sender:', profileError);
      // Try to get user email from auth metadata if available
      // Note: We can't directly access auth.users, but we can use the user object
      // For now, we'll use a fallback
    }

    // Transform message with username from profiles table
    const username = profile ? normalizeProfileUsername(profile) : 'User';

    // Fetch attachments for this message
    let messageAttachments: { id: string; fileUrl: string; fileName: string; fileType: string; fileSize: number; mimeType: string; }[] = [];
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      const { data: fetchedAttachments } = await supabase
        .from('message_attachments')
        .select('*')
        .eq('message_id', message.id);
      
      if (fetchedAttachments) {
        messageAttachments = fetchedAttachments.map((att: any) => ({
          id: att.id,
          fileUrl: att.file_url,
          fileName: att.file_name,
          fileType: att.file_type,
          fileSize: att.file_size,
          mimeType: att.mime_type,
        }));
      }
    }

    // Fetch reply preview if this is a reply
    let replyPreview = undefined;
    if (message.reply_to_id) {
      const { data: replyMessage } = await supabase
        .from('messages')
        .select('id, content, user_id')
        .eq('id', message.reply_to_id)
        .single();
      
      if (replyMessage) {
        const { data: replyProfile } = await supabase
          .from('profiles')
          .select('id, username, email')
          .eq('id', replyMessage.user_id)
          .single();
        
        const replyUsername = replyProfile
          ? normalizeProfileUsername(replyProfile)
          : 'User';
        
        replyPreview = {
          id: replyMessage.id,
          username: replyUsername,
          content: replyMessage.content.substring(0, 50) + (replyMessage.content.length > 50 ? '...' : ''),
        };
      }
    }

    const transformedMessage = {
      id: message.id,
      content: message.content,
      replyTo: message.reply_to_id,
      replyPreview,
      attachments: messageAttachments.length > 0 ? messageAttachments : undefined,
      edited: !!message.edited_at,
      timestamp: new Date(message.created_at).getTime(),
      user: {
        id: message.user_id,
        username,
        avatarUrl: '',
      },
    };

    return NextResponse.json({ message: transformedMessage }, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/chats/[chatId]/messages:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
