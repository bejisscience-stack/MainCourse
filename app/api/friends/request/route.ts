import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyTokenAndGetUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// POST /api/friends/request - Send a friend request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { receiverId } = body;

    if (!receiverId || typeof receiverId !== 'string') {
      return NextResponse.json(
        { error: 'Receiver ID is required' },
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

    // Prevent self-friend requests
    if (receiverId === user.id) {
      return NextResponse.json(
        { error: 'Cannot send friend request to yourself' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient(token);

    // Check if receiver exists
    // First verify the user ID is valid (check if it's a valid UUID)
    if (!receiverId || typeof receiverId !== 'string' || receiverId.length !== 36) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    // Try to fetch receiver profile
    // Note: We need to use a service role or bypass RLS for friend requests
    // since users don't need to be in the same course to be friends
    const { data: receiver, error: receiverError } = await supabase
      .from('profiles')
      .select('id, username, email')
      .eq('id', receiverId)
      .single();

    if (receiverError || !receiver) {
      console.error('Error fetching receiver profile:', receiverError);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify receiver has a username (required field)
    if (!receiver.username || receiver.username.trim() === '') {
      console.warn(`Receiver ${receiverId} exists but has no username`);
      // Still allow the request, username will be handled in display
    }

    // Check if already friends
    const { data: existingFriendship } = await supabase
      .from('friendships')
      .select('id')
      .or(`and(user1_id.eq.${user.id},user2_id.eq.${receiverId}),and(user1_id.eq.${receiverId},user2_id.eq.${user.id})`)
      .single();

    if (existingFriendship) {
      return NextResponse.json(
        { error: 'Already friends with this user' },
        { status: 409 }
      );
    }

    // Check if there's already a pending request (either direction)
    const { data: existingRequest } = await supabase
      .from('friend_requests')
      .select('id, sender_id, receiver_id, status')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user.id})`)
      .single();

    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        if (existingRequest.sender_id === user.id) {
          return NextResponse.json(
            { error: 'Friend request already sent' },
            { status: 409 }
          );
        } else {
          return NextResponse.json(
            { error: 'This user has already sent you a friend request' },
            { status: 409 }
          );
        }
      } else if (existingRequest.status === 'accepted') {
        return NextResponse.json(
          { error: 'Already friends with this user' },
          { status: 409 }
        );
      }
    }

    // Create friend request
    const { data: friendRequest, error: requestError } = await supabase
      .from('friend_requests')
      .insert({
        sender_id: user.id,
        receiver_id: receiverId,
        status: 'pending',
      })
      .select()
      .single();

    if (requestError) {
      if (requestError.code === '23505') {
        return NextResponse.json(
          { error: 'Friend request already exists' },
          { status: 409 }
        );
      }
      console.error('Error creating friend request:', requestError);
      return NextResponse.json(
        { error: 'Failed to send friend request', details: requestError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      friendRequest,
      message: 'Friend request sent successfully',
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/friends/request:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/friends/request - Cancel a sent friend request
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const requestId = searchParams.get('requestId');

    if (!requestId) {
      return NextResponse.json(
        { error: 'Request ID is required' },
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

    // Verify the request exists and user is the sender
    const { data: friendRequest, error: fetchError } = await supabase
      .from('friend_requests')
      .select('id, sender_id, status')
      .eq('id', requestId)
      .single();

    if (fetchError || !friendRequest) {
      return NextResponse.json(
        { error: 'Friend request not found' },
        { status: 404 }
      );
    }

    if (friendRequest.sender_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: Can only cancel your own friend requests' },
        { status: 403 }
      );
    }

    if (friendRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'Can only cancel pending friend requests' },
        { status: 400 }
      );
    }

    // Delete the friend request
    const { error: deleteError } = await supabase
      .from('friend_requests')
      .delete()
      .eq('id', requestId);

    if (deleteError) {
      console.error('Error deleting friend request:', deleteError);
      return NextResponse.json(
        { error: 'Failed to cancel friend request', details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Friend request cancelled successfully',
    }, { status: 200 });
  } catch (error: any) {
    console.error('Error in DELETE /api/friends/request:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
