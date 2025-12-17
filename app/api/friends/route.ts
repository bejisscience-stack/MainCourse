import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyTokenAndGetUser } from '@/lib/supabase-server';
import { normalizeProfileUsername } from '@/lib/username';

export const dynamic = 'force-dynamic';

// GET /api/friends - Get user's friends list with course information
export async function GET(request: NextRequest) {
  try {
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

    // Get all friendships where user is involved
    const { data: friendships, error: friendshipsError } = await supabase
      .from('friendships')
      .select('*')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

    if (friendshipsError) {
      console.error('Error fetching friendships:', friendshipsError);
      return NextResponse.json(
        { error: 'Failed to fetch friends', details: friendshipsError.message },
        { status: 500 }
      );
    }

    // Get friend IDs
    const friendIds = friendships.map(f => 
      f.user1_id === user.id ? f.user2_id : f.user1_id
    );

    if (friendIds.length === 0) {
      return NextResponse.json({
        friends: [],
        message: 'No friends found',
      });
    }

    // Get friend profiles
    const { data: friendProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, email, avatar_url')
      .in('id', friendIds);

    if (profilesError) {
      console.error('Error fetching friend profiles:', profilesError);
      return NextResponse.json(
        { error: 'Failed to fetch friend profiles', details: profilesError.message },
        { status: 500 }
      );
    }

    // Get user's enrolled courses (for showing common courses, not required for friendship)
    const { data: userEnrollments } = await supabase
      .from('enrollments')
      .select('course_id')
      .eq('user_id', user.id);

    const userCourseIds = userEnrollments?.map(e => e.course_id) || [];

    // Get friends' enrollments to find common courses (optional feature)
    let friendEnrollments: any[] = [];
    if (userCourseIds.length > 0 && friendIds.length > 0) {
      const { data } = await supabase
        .from('enrollments')
        .select('user_id, course_id')
        .in('user_id', friendIds)
        .in('course_id', userCourseIds);
      
      if (data) {
        friendEnrollments = data;
      }
    }

    // Build friends list with common courses
    const friends = friendProfiles.map(profile => {
      const commonCourses = friendEnrollments
        .filter(e => e.user_id === profile.id && userCourseIds.includes(e.course_id))
        .map(e => e.course_id);

      return {
        id: profile.id,
        username: normalizeProfileUsername(profile),
        email: profile.email,
        avatarUrl: profile.avatar_url,
        commonCourses: commonCourses.length,
        commonCourseIds: commonCourses,
      };
    });

    return NextResponse.json({
      friends,
      message: 'Friends retrieved successfully',
    });
  } catch (error: any) {
    console.error('Error in GET /api/friends:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/friends/:friendId - Remove a friend
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const friendId = searchParams.get('friendId');

    if (!friendId) {
      return NextResponse.json(
        { error: 'Friend ID is required' },
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

    // Verify friendship exists
    const { data: friendship, error: fetchError } = await supabase
      .from('friendships')
      .select('id, user1_id, user2_id')
      .or(`and(user1_id.eq.${user.id},user2_id.eq.${friendId}),and(user1_id.eq.${friendId},user2_id.eq.${user.id})`)
      .single();

    if (fetchError || !friendship) {
      return NextResponse.json(
        { error: 'Friendship not found' },
        { status: 404 }
      );
    }

    // Delete the friendship
    const { error: deleteError } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendship.id);

    if (deleteError) {
      console.error('Error deleting friendship:', deleteError);
      return NextResponse.json(
        { error: 'Failed to remove friend', details: deleteError.message },
        { status: 500 }
      );
    }

    // Also update any related friend requests to rejected
    await supabase
      .from('friend_requests')
      .update({ status: 'rejected' })
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`)
      .eq('status', 'accepted');

    return NextResponse.json({
      message: 'Friend removed successfully',
    }, { status: 200 });
  } catch (error: any) {
    console.error('Error in DELETE /api/friends:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

