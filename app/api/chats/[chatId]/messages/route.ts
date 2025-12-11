import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyTokenAndGetUser } from '@/lib/supabase-server';

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
    
    // Try to fetch profiles - RLS should allow this if users are in same course
    const profileMap = new Map();
    
    if (userIds.length > 0) {
      // First try batch fetch
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      if (profiles && !profilesError && profiles.length > 0) {
        profiles.forEach((profile: any) => {
          profileMap.set(profile.id, profile);
          // Log if full_name is missing
          if (!profile.full_name || profile.full_name.trim() === '') {
            console.warn(`Profile for user ${profile.id} exists but full_name is empty. Email: ${profile.email}`);
          }
        });
        console.log(`Successfully fetched ${profiles.length} profiles out of ${userIds.length} users`);
      } else {
        // If batch fetch fails, try individual fetches (might work better with RLS)
        console.warn('Batch profile fetch failed, trying individual fetches:', profilesError);
        
        for (const userId of userIds) {
          try {
            const { data: singleProfile, error: singleError } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .eq('id', userId)
              .single();
            
            if (singleProfile && !singleError) {
              profileMap.set(userId, singleProfile);
              // Log if full_name is missing
              if (!singleProfile.full_name || singleProfile.full_name.trim() === '') {
                console.warn(`Profile for user ${userId} exists but full_name is empty. Email: ${singleProfile.email}`);
              }
            } else {
              console.warn(`Failed to fetch profile for user ${userId}:`, singleError);
              console.warn(`This might be due to RLS policy. Check if migration 018_update_profiles_rls_for_chat.sql was run.`);
            }
          } catch (err: any) {
            console.warn(`Exception fetching profile for user ${userId}:`, err);
          }
        }
        
        console.log(`Fetched ${profileMap.size} profiles individually out of ${userIds.length} users`);
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

    const transformedMessages = (messages || []).map((msg: any) => {
      const profile = profileMap.get(msg.user_id);
      let username = 'User';
      
      if (profile) {
        // Prioritize full_name, then email username, then fallback
        username = profile.full_name?.trim() || profile.email?.split('@')[0] || 'User';
      } else {
        // If profile fetch failed, try to get from auth metadata or use email pattern
        // This should rarely happen if RLS is set up correctly
        console.warn(`Profile not found for user ${msg.user_id}, using fallback`);
        // Try to extract a readable identifier from user_id
        const userIdShort = msg.user_id.substring(0, 8);
        username = `User-${userIdShort}`;
      }
      
      // Ensure username is never empty
      if (!username || username.trim() === '') {
        username = 'User';
      }
      
      return {
        id: msg.id,
        content: msg.content,
        replyTo: msg.reply_to_id,
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
    const { content, replyTo } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      );
    }

    if (content.length > 4000) {
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

    // Sanitize content (basic XSS prevention)
    const sanitizedContent = content.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

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

    // Fetch user profile separately with better error handling
    let profile = null;
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
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

    // Transform message with better username resolution
    let username = 'User';
    if (profile) {
      username = profile.full_name?.trim() || profile.email?.split('@')[0] || 'User';
    } else if (user.email) {
      username = user.email.split('@')[0];
    } else {
      username = user.id.substring(0, 8);
    }
    
    // Ensure username is never empty
    if (!username || username.trim() === '') {
      username = 'User';
    }

    const transformedMessage = {
      id: message.id,
      content: message.content,
      replyTo: message.reply_to_id,
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
