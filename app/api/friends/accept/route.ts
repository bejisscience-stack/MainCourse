import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyTokenAndGetUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// POST /api/friends/accept - Accept a friend request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { requestId } = body;

    if (!requestId || typeof requestId !== 'string') {
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

    // Verify the request exists and user is the receiver
    const { data: friendRequest, error: fetchError } = await supabase
      .from('friend_requests')
      .select('id, sender_id, receiver_id, status')
      .eq('id', requestId)
      .single();

    if (fetchError || !friendRequest) {
      return NextResponse.json(
        { error: 'Friend request not found' },
        { status: 404 }
      );
    }

    if (friendRequest.receiver_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: Can only accept friend requests sent to you' },
        { status: 403 }
      );
    }

    if (friendRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'Friend request is not pending' },
        { status: 400 }
      );
    }

    // Update the friend request status to accepted
    // The trigger will automatically create the friendship
    const { data: updatedRequest, error: updateError } = await supabase
      .from('friend_requests')
      .update({ status: 'accepted' })
      .eq('id', requestId)
      .select()
      .single();

    if (updateError) {
      console.error('Error accepting friend request:', updateError);
      return NextResponse.json(
        { error: 'Failed to accept friend request', details: updateError.message },
        { status: 500 }
      );
    }

    // Get the friendship that was created
    const user1 = friendRequest.sender_id < friendRequest.receiver_id 
      ? friendRequest.sender_id 
      : friendRequest.receiver_id;
    const user2 = friendRequest.sender_id < friendRequest.receiver_id 
      ? friendRequest.receiver_id 
      : friendRequest.sender_id;

    const { data: friendship } = await supabase
      .from('friendships')
      .select('*')
      .eq('user1_id', user1)
      .eq('user2_id', user2)
      .single();

    return NextResponse.json({
      friendRequest: updatedRequest,
      friendship,
      message: 'Friend request accepted successfully',
    }, { status: 200 });
  } catch (error: any) {
    console.error('Error in POST /api/friends/accept:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
